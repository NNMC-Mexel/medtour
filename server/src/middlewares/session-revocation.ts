/**
 * Отклоняет отозванные JWT (см. utils/user-session.ts).
 *
 * Невалидный или «чужой» токен (admin-JWT, API-токен) пропускаем дальше —
 * его судьбу решает штатная стратегия аутентификации Strapi.
 */
import { revocationBoundarySeconds } from '../utils/user-session';

const getBearerToken = (ctx: any) => {
  const header = String(ctx.request?.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

const reject = (ctx: any, message: string) => {
  ctx.status = 401;
  ctx.body = { data: null, error: { status: 401, name: 'UnauthorizedError', message } };
};

export default (_config, { strapi }) => {
  return async (ctx, next) => {
    const token = getBearerToken(ctx);
    if (!token) return next();

    let payload: any;
    try {
      payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
    } catch {
      return next();
    }

    if (!payload?.id || !payload?.iat) return next();

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: payload.id },
      select: ['id', 'blocked', 'tokenValidAfter'],
    });

    if (!user) return reject(ctx, 'Session is no longer valid');
    // Блокировка должна действовать сразу, а не после истечения токена.
    if (user.blocked) return reject(ctx, 'Account is blocked');

    const boundary = revocationBoundarySeconds(user.tokenValidAfter);
    if (boundary !== null && Number(payload.iat) < boundary) {
      return reject(ctx, 'Session has been revoked');
    }

    return next();
  };
};
