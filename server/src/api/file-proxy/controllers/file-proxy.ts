import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getUserRole } from '../../../utils/medtour-access';

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

async function getAuthenticatedUser(ctx) {
  const authHeader = ctx.request.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = bearerToken || ctx.query?.token;

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

async function assertMedicalDocumentFileAccess(ctx, key: string) {
  const uploadFile = await findUploadFileByKey(key);

  // Non-medical media, for example doctor photos and landing assets, remains public.
  if (!uploadFile) return true;

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
  if (!medicalDocument) return true;

  const user = await getAuthenticatedUser(ctx);
  return Boolean(user && canAccessMedicalDocumentFile(user, medicalDocument));
}

export default {
  async proxy(ctx) {
    const { key } = ctx.params;

    if (!process.env.MINIO_ENDPOINT && !process.env.S3_ENDPOINT) {
      ctx.status = 404;
      ctx.body = { error: 'Storage not configured' };
      return;
    }

    const hasAccess = await assertMedicalDocumentFileAccess(ctx, key);
    if (!hasAccess) {
      ctx.status = 403;
      ctx.body = { error: 'Forbidden' };
      return;
    }

    try {
      const s3 = getS3Client();
      const command = new GetObjectCommand({
        Bucket: process.env.MINIO_BUCKET || process.env.S3_BUCKET,
        Key: key,
      });

      const response = await s3.send(command);

      ctx.set('Content-Type', response.ContentType || 'application/octet-stream');
      if (response.ContentLength) {
        ctx.set('Content-Length', String(response.ContentLength));
      }
      ctx.set('Cache-Control', 'private, max-age=300');

      ctx.body = response.Body as any;
    } catch {
      ctx.status = 404;
      ctx.body = { error: 'File not found' };
    }
  },
};
