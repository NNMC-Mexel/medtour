import { revokeUserSessions, verifyUserSession } from '../../../utils/user-session';

const getBearerToken = (ctx: any) => {
  const header = String(ctx.request?.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

export default {
  /**
   * POST /api/auth/logout
   *
   * Сдвигает `tokenValidAfter`, поэтому все ранее выданные пользователю JWT
   * перестают приниматься. Без этого выход был чисто клиентским: токен,
   * снятый с устройства, работал до конца срока (30 дней).
   */
  async logout(ctx) {
    const user = await verifyUserSession(strapi, getBearerToken(ctx));
    if (!user) return ctx.unauthorized('Not authenticated');

    await revokeUserSessions(strapi, user.id);
    strapi.log.info(JSON.stringify({ audit: 'LOGOUT', userId: user.id, ts: new Date().toISOString() }));

    ctx.body = { ok: true };
  },
};
