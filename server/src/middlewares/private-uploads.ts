import { decideFileAccess } from '../api/file-proxy/controllers/file-proxy';

/**
 * Strapi's local upload provider normally exposes /uploads as public static
 * files. Medical documents must keep the same access policy in local/dev
 * storage as they do behind the S3 file proxy.
 *
 * Non-medical uploads continue to the regular static middleware. Protected
 * files are authorised by the same case/appointment boundary as /file-proxy.
 */
export default (_config, _context) => async (ctx, next) => {
  const requestPath = String(ctx.request.path || '');
  if (!['GET', 'HEAD'].includes(ctx.method) || !requestPath.startsWith('/uploads/')) {
    return next();
  }

  const key = requestPath.slice('/uploads/'.length);
  const decision = await decideFileAccess(ctx, key);

  if (decision.allowed === false && decision.reason === 'unauthorized') {
    ctx.status = 404;
    ctx.body = { error: 'File not found' };
    return;
  }

  if (decision.allowed && decision.isMedicalDocument) {
    const filename = decodeURIComponent(key).split('/').pop()?.replace(/[^\w.\-]/g, '_') || 'document';
    ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
    ctx.set('Cache-Control', 'private, max-age=300');
    ctx.set('X-Content-Type-Options', 'nosniff');
  }

  return next();
};
