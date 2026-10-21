/**
 * Notification controller.
 * - find: каждый, включая админа, видит только свои уведомления
 * - unreadCount: число непрочитанных у текущего пользователя
 * - markAllAsRead: помечает все непрочитанные текущего пользователя (одним запросом)
 * - update/delete: только владелец
 *
 * Раньше админ получал в колокольчике уведомления всех пользователей
 * (превью чужих чатов), а «Прочитать все» помечало только его собственные:
 * чужие непрочитанные возвращались при следующем опросе. Клик админа по
 * чужому уведомлению гасил бейдж у настоящего получателя.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::notification.notification', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const queryFilters = (ctx.query?.filters as any) || {};
    const filters: any = { ...queryFilters, user: { id: user.id } };

    const sort = (ctx.query?.sort as any) || ['createdAt:desc'];
    const limitRaw = (ctx.query?.pagination as any)?.limit;
    const limit = Math.min(Number(limitRaw) || 50, 200);

    const data = await strapi.documents('api::notification.notification').findMany({
      filters,
      sort,
      limit,
    });

    return {
      data,
      meta: {
        pagination: {
          page: 1,
          pageSize: data.length,
          pageCount: 1,
          total: data.length,
        },
      },
    };
  },

  async unreadCount(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const count = await strapi.documents('api::notification.notification').count({
      filters: { user: { id: user.id }, isRead: false },
    });

    return { data: { count } };
  },

  async markAllAsRead(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    // Одним запросом и без лимита. Раньше помечалась первая 1000 по одной:
    // у менеджера, которому приходят уведомления по всем чатам, свежие
    // оставались непрочитанными, и бейдж возвращался при следующем опросе.
    // У уведомлений нет черновиков, поэтому обновление на уровне БД безопасно.
    // updateMany не фильтрует по связи, поэтому сначала берём id, затем
    // обновляем пачками (у SQLite ограничено число параметров в запросе).
    const query = strapi.db.query('api::notification.notification');
    const unread = await query.findMany({
      where: { user: { id: user.id }, isRead: false },
      select: ['id'],
    });
    const ids = unread.map((item: any) => item.id);
    for (let start = 0; start < ids.length; start += 500) {
      await query.updateMany({
        where: { id: { $in: ids.slice(start, start + 500) } },
        data: { isRead: true },
      });
    }

    return { data: { count: ids.length } };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const { id } = ctx.params;
    const existing = await strapi.documents('api::notification.notification').findOne({
      documentId: id,
      populate: { user: { fields: ['id'] } },
    });
    if (!existing) return ctx.notFound('Notification not found');

    if ((existing as any).user?.id !== user.id) {
      return ctx.forbidden('Cannot update this notification');
    }

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const updated = await strapi.documents('api::notification.notification').update({
      documentId: id,
      data: { isRead: typeof body.isRead === 'boolean' ? body.isRead : true } as any,
    });

    return { data: updated };
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const { id } = ctx.params;
    const existing = await strapi.documents('api::notification.notification').findOne({
      documentId: id,
      populate: { user: { fields: ['id'] } },
    });
    if (!existing) return ctx.notFound('Notification not found');

    if ((existing as any).user?.id !== user.id) {
      return ctx.forbidden('Cannot delete this notification');
    }

    await strapi.documents('api::notification.notification').delete({ documentId: id });
    return { data: { documentId: id } };
  },
}));
