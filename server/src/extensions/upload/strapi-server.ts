/**
 * Расширение upload для content API.
 *
 * - `POST /api/upload?id=X` в Strapi заменяет существующий файл, а поля
 *   ref/refId/field прикрепляют загрузку к произвольной записи. Обычный клиент
 *   так делать не должен: иначе пациент мог перезаписать чужой медицинский
 *   файл или прикрепить загрузку к чужой сущности в обход контроллеров.
 * - Каждой загрузке проставляется автор (`uploadedByUserId`), по которому
 *   utils/file-attach разрешает прикреплять только свои свежие файлы.
 *
 * Типы и размеры файлов проверяет middleware upload-guard.
 */
export default (plugin: any) => {
  plugin.contentTypes.file.schema.attributes.uploadedByUserId = {
    type: 'integer',
    private: true,
    configurable: false,
  };

  const originalContentApiFactory = plugin.controllers['content-api'];

  plugin.controllers['content-api'] = (factoryContext: any) => {
    const originalController = originalContentApiFactory(factoryContext);
    const originalUpload = originalController.upload;

    return {
      ...originalController,

      async upload(ctx: any) {
        const user = ctx.state?.user;
        const isAdmin = user?.role?.type === 'admin' || user?.userRole === 'admin';
        const isApiToken = ctx.state?.auth?.strategy?.name === 'content-api-token' || ctx.state?.auth?.strategy?.name === 'api-token';
        const privileged = isAdmin || isApiToken;

        if (!privileged && ctx.query?.id !== undefined) {
          return ctx.forbidden('Only administrators can replace uploads');
        }
        const body = ctx.request?.body || {};
        if (!privileged && ['ref', 'refId', 'field'].some((key) => body[key] !== undefined)) {
          return ctx.forbidden('Attach files through the document or message endpoint');
        }

        await originalUpload.call(this, ctx);

        if (user?.id && ctx.query?.id === undefined) {
          const uploaded = Array.isArray(ctx.body) ? ctx.body : [ctx.body];
          for (const file of uploaded) {
            if (file?.id) {
              await strapi.db.query('plugin::upload.file').update({
                where: { id: file.id },
                data: { uploadedByUserId: user.id } as any,
              });
            }
          }
        }
      },
    };
  };

  return plugin;
};
