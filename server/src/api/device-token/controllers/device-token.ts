import { factories } from '@strapi/strapi';

const UID = 'api::device-token.device-token' as any;
const ALLOWED_PLATFORMS = new Set(['ios', 'android']);

function normalizeToken(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export default factories.createCoreController(UID, () => ({
  async register(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const body = (ctx.request.body as any) || {};
    const token = normalizeToken(body.token);
    const platform = typeof body.platform === 'string' ? body.platform : '';
    const appId = typeof body.appId === 'string' ? body.appId.slice(0, 120) : 'kz.nnmc.medtour';

    if (!token || token.length > 4096) return ctx.badRequest('Invalid device token');
    if (!ALLOWED_PLATFORMS.has(platform)) return ctx.badRequest('Invalid platform');

    const userRef = user.documentId || user.id;
    const existing = await strapi.documents(UID).findMany({
      filters: { token },
      limit: 1,
    });

    const data = {
      token,
      platform,
      appId,
      user: userRef,
      lastSeenAt: new Date().toISOString(),
      disabledAt: null,
    } as any;

    const item = existing[0]?.documentId
      ? await strapi.documents(UID).update({ documentId: existing[0].documentId, data })
      : await strapi.documents(UID).create({ data });

    return { data: { documentId: item.documentId, platform: item.platform } };
  },

  async unregister(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const body = (ctx.request.body as any) || {};
    const token = normalizeToken(body.token);
    if (!token) return { data: { removed: 0 } };

    const existing = await strapi.documents(UID).findMany({
      filters: {
        token,
        user: { id: user.id },
      },
      limit: 5,
    });

    for (const item of existing as any[]) {
      if (item.documentId) {
        await strapi.documents(UID).delete({ documentId: item.documentId });
      }
    }

    return { data: { removed: existing.length } };
  },
}));
