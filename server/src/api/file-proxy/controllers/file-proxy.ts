import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getUserRole, isAdminUser, userCanAccessMedicalCase } from '../../../utils/medtour-access';

const getS3Client = () =>
  new S3Client({
    credentials: {
      accessKeyId: (process.env.MINIO_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID)!,
      secretAccessKey: (process.env.MINIO_SECRET_KEY || process.env.S3_ACCESS_SECRET)!,
    },
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.MINIO_ENDPOINT || process.env.S3_ENDPOINT,
    forcePathStyle: true,
  });

/**
 * Content types whose attached files are public by design — clinic logos,
 * doctor avatars, landing illustrations, etc. Any upload NOT related to
 * one of these AND NOT related to a medical-document is treated as orphan
 * and refused (default-deny).
 *
 * Keep this list narrow. Add new entries only for content types whose
 * attached files are intentionally world-readable.
 */
const PUBLIC_CONTENT_UIDS = new Set<string>([
  'api::clinic.clinic',
  'api::doctor.doctor',
  'api::guide-video.guide-video',
  'api::global.global',
  'api::about.about',
  'api::article.article',
  'api::author.author',
  'api::category.category',
  'api::specialization.specialization',
  'api::price-item.price-item',
  'api::tourism-package.tourism-package',
  'api::review.review',
]);

/**
 * MIME types we are willing to serve inline (i.e. with the upload's own
 * Content-Type). Anything else — including text/html, image/svg+xml, scripts
 * and executables — is forced to application/octet-stream + attachment, so
 * the browser cannot execute it on our origin.
 *
 * The upload-guard middleware should already reject these at upload time;
 * this is defence in depth for files that pre-date the middleware.
 */
const INLINE_SAFE_MIME = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
]);

async function getAuthenticatedUser(ctx) {
  const authHeader = ctx.request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token || typeof token !== 'string') return null;

  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const payload = await jwtService.verify(token);

    if (!payload?.id) return null;

    return strapi.query('plugin::users-permissions.user').findOne({
      where: { id: payload.id },
      populate: { role: true },
    });
  } catch {
    return null;
  }
}

function getFileHashAndExt(key: string) {
  const decodedKey = decodeURIComponent(key);
  const filename = decodedKey.split('/').pop() || decodedKey;
  const dotIndex = filename.lastIndexOf('.');

  if (dotIndex === -1) {
    return { hash: filename, ext: undefined };
  }

  return {
    hash: filename.slice(0, dotIndex),
    ext: filename.slice(dotIndex),
  };
}

async function findUploadFileByKey(key: string) {
  const { hash, ext } = getFileHashAndExt(key);

  const exactMatches = await strapi.query('plugin::upload.file').findMany({
    where: ext ? { hash, ext } : { hash },
    limit: 1,
  });

  if (exactMatches[0]) return exactMatches[0];

  const fallbackMatches = await strapi.query('plugin::upload.file').findMany({
    where: { url: { $contains: key } },
    limit: 1,
  });

  return fallbackMatches[0] || null;
}

function doctorUserMatches(doctor: any, userId: number) {
  return doctor?.users_permissions_user?.id === userId;
}

function canAccessMedicalDocumentFile(user: any, doc: any) {
  const role = getUserRole(user);
  if (role === 'admin') return true;

  if (doc.user?.id === user.id) return true;
  if (doctorUserMatches(doc.doctor, user.id)) return true;
  if (doc.sharedWithDoctors?.some((doctor: any) => doctorUserMatches(doctor, user.id))) return true;

  const medicalCase = doc.medical_case;
  if (!medicalCase) return false;

  if (medicalCase.patient?.id === user.id) return true;
  if (medicalCase.manager?.id === user.id) return true;
  if (medicalCase.coordinator?.id === user.id) return true;
  if (doctorUserMatches(medicalCase.doctor, user.id)) return true;

  return false;
}

type AccessDecision =
  | { allowed: true; isMedicalDocument: boolean }
  | { allowed: false; reason: 'not-found' | 'unauthorized' };

async function decideFileAccess(ctx, key: string): Promise<AccessDecision> {
  const uploadFile = await findUploadFileByKey(key);

  // Default-deny: an unknown key is treated as not-found.
  // Previously this returned "allowed" which turned the proxy into an open
  // file host for anyone who could guess a hash.
  if (!uploadFile) return { allowed: false, reason: 'not-found' };

  // Inspect the file's polymorphic relations to see what content type
  // currently owns it. Strapi stores these in the files_related_morphs
  // pivot table, exposed via the `related` morph relation.
  const fileWithRelations: any = await strapi.query('plugin::upload.file').findOne({
    where: { id: uploadFile.id },
    populate: { related: true },
  });

  const relations: any[] = Array.isArray(fileWithRelations?.related) ? fileWithRelations.related : [];

  // 1. Allow files attached to known public collection types.
  for (const relation of relations) {
    const uid = relation?.__type || relation?.__contentType || relation?.uid;
    if (uid && PUBLIC_CONTENT_UIDS.has(uid)) {
      return { allowed: true, isMedicalDocument: false };
    }
  }

  // 2. Chat attachments are private too, but they are linked to messages
  //    rather than medical-document. Authorise through conversation/case RBAC.
  const user = await getAuthenticatedUser(ctx);
  const messages = await strapi.documents('api::message.message' as any).findMany({
    filters: { attachments: { id: uploadFile.id } },
    limit: 1,
    populate: {
      conversation: {
        populate: {
          users_permissions_users: { fields: ['id', 'documentId'] },
          medical_case: true,
        },
      },
    } as any,
  });

  const message = messages[0] as any;
  if (message) {
    const conversation = message.conversation;
    const members = Array.isArray(conversation?.users_permissions_users) ? conversation.users_permissions_users : [];
    const memberAccess = user && members.some((member: any) => member?.id === user.id);
    const caseAccess = user && conversation?.medical_case
      ? await userCanAccessMedicalCase(strapi, user, conversation.medical_case)
      : false;
    if (user && (isAdminUser(user) || memberAccess || caseAccess)) {
      return { allowed: true, isMedicalDocument: true };
    }
    return { allowed: false, reason: 'not-found' };
  }

  // 3. Otherwise, the file MUST be attached to a medical-document, and the
  //    caller must have access to it. Look it up with full ownership chain.
  const medicalDocuments = await strapi.documents('api::medical-document.medical-document').findMany({
    filters: { file: { id: uploadFile.id } },
    limit: 1,
    populate: {
      user: { fields: ['id'] },
      doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
      sharedWithDoctors: { populate: { users_permissions_user: { fields: ['id'] } } },
      medical_case: {
        populate: {
          patient: { fields: ['id'] },
          manager: { fields: ['id'] },
          coordinator: { fields: ['id'] },
          doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
        },
      },
    } as any,
  });

  const medicalDocument = medicalDocuments[0];

  // 4. If the upload exists but is linked to nothing (orphan) — refuse.
  //    This covers race conditions during upload, failed link attempts,
  //    and files left over after parent records were deleted.
  if (!medicalDocument) return { allowed: false, reason: 'not-found' };

  if (user && canAccessMedicalDocumentFile(user, medicalDocument)) {
    return { allowed: true, isMedicalDocument: true };
  }

  // Returning "not-found" rather than "unauthorized" prevents an attacker
  // from learning whether a particular hash maps to an existing medical
  // document.
  return { allowed: false, reason: 'not-found' };
}

function safeFilename(name: string | undefined | null) {
  if (!name) return 'file';
  // Strip everything but word chars, dash, dot — same policy as upload sanitisation.
  return String(name).replace(/[^\w.\-]/g, '_').slice(0, 200) || 'file';
}

export default {
  async proxy(ctx) {
    const { key } = ctx.params;

    if (!process.env.MINIO_ENDPOINT && !process.env.S3_ENDPOINT) {
      ctx.status = 404;
      ctx.body = { error: 'Storage not configured' };
      return;
    }

    const decision = await decideFileAccess(ctx, key);
    if (!decision.allowed) {
      // Unified response — never distinguish between "no such file" and
      // "exists but you have no access". Both must return 404 to avoid
      // turning the proxy into an existence oracle.
      ctx.status = 404;
      ctx.body = { error: 'File not found' };
      return;
    }

    try {
      const s3 = getS3Client();
      const command = new GetObjectCommand({
        Bucket: process.env.MINIO_BUCKET || process.env.S3_BUCKET,
        Key: key,
      });

      const response = await s3.send(command);

      const originalContentType = response.ContentType || 'application/octet-stream';
      const isInlineSafe = INLINE_SAFE_MIME.has(originalContentType.toLowerCase());

      // For medical documents we ALWAYS force a download. The file may still
      // be a legitimate PDF, but rendering inline opens up SVG-script XSS,
      // embedded HTML, etc. The patient/staff UI knows how to download.
      // For public assets (logos, avatars) inline rendering is the point.
      if (decision.isMedicalDocument || !isInlineSafe) {
        const filename = safeFilename(key.split('/').pop());
        ctx.set('Content-Type', isInlineSafe ? originalContentType : 'application/octet-stream');
        ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
      } else {
        ctx.set('Content-Type', originalContentType);
      }

      if (response.ContentLength) {
        ctx.set('Content-Length', String(response.ContentLength));
      }
      ctx.set('Cache-Control', 'private, max-age=300');
      // Defence in depth: tell the browser not to MIME-sniff and not to
      // open in an embedded plugin if Content-Type lies.
      ctx.set('X-Content-Type-Options', 'nosniff');

      ctx.body = response.Body as any;
    } catch {
      ctx.status = 404;
      ctx.body = { error: 'File not found' };
    }
  },
};
