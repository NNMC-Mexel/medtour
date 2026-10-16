/**
 * Правовые документы: публичные страницы /documents/:slug и редактор в админке.
 *
 * Документы большие (десятки тысяч символов на язык), поэтому публичная
 * страница получает только один язык, а список — без текстов.
 */

import { factories } from '@strapi/strapi';
import {
  availableLanguages,
  mergeLocalized,
  resolveLanguage,
  validateLegalUpdate,
} from '../../../utils/legal-documents';

const UID = 'api::legal-document.legal-document' as any;

const findBySlug = (strapi: any, slug: string) =>
  strapi.documents(UID).findFirst({ filters: { slug } });

const pickTitle = (title: any, lang: string) =>
  (title && typeof title === 'object' && (title[lang] || title.ru)) || '';

export default factories.createCoreController(UID, ({ strapi }) => ({
  /** GET /legal-documents — список для страницы «Документы» и подвала. */
  async list(ctx) {
    // Тела читаем только чтобы посчитать языки — в ответ они не попадают.
    const docs = await strapi.documents(UID).findMany({ sort: ['sortOrder:asc', 'slug:asc'] } as any);
    ctx.body = {
      data: docs.map((doc: any) => ({
        slug: doc.slug,
        title: doc.title || {},
        revisionDate: doc.revisionDate || null,
        updatedAt: doc.updatedAt,
        languages: availableLanguages(doc.body),
      })),
    };
  },

  /** GET /legal-documents/:slug?lang=ru — один документ на одном языке. */
  async findBySlug(ctx) {
    const doc: any = await findBySlug(strapi, String(ctx.params.slug || ''));
    if (!doc) return ctx.notFound('Document not found');
    const lang = resolveLanguage(doc.body, ctx.query?.lang);
    if (!lang) return ctx.notFound('Document has no text yet');
    ctx.body = {
      data: {
        slug: doc.slug,
        lang,
        languages: availableLanguages(doc.body),
        title: pickTitle(doc.title, lang),
        body: doc.body[lang],
        revisionDate: doc.revisionDate || null,
        updatedAt: doc.updatedAt,
      },
    };
  },

  /** GET /legal-documents/:slug/edit — все языки для редактора (только админ). */
  async findForEdit(ctx) {
    const doc: any = await findBySlug(strapi, String(ctx.params.slug || ''));
    if (!doc) return ctx.notFound('Document not found');
    ctx.set('Cache-Control', 'no-store');
    ctx.body = {
      data: {
        slug: doc.slug,
        title: doc.title || {},
        body: doc.body || {},
        revisionDate: doc.revisionDate || null,
        updatedAt: doc.updatedAt,
      },
    };
  },

  /**
   * PUT /legal-documents/:slug — правка админа. Создавать и удалять документы
   * через API нельзя: набор документов задаётся в коде (seed).
   * expectedUpdatedAt защищает от затирания чужой правки из второй вкладки.
   */
  async updateBySlug(ctx) {
    const doc: any = await findBySlug(strapi, String(ctx.params.slug || ''));
    if (!doc) return ctx.notFound('Document not found');

    const input = (ctx.request.body as any)?.data;
    const expected = input?.expectedUpdatedAt;
    if (expected && new Date(expected).getTime() !== new Date(doc.updatedAt).getTime()) {
      return ctx.conflict('Document was changed by someone else. Reload it before saving.');
    }
    const { expectedUpdatedAt, ...fields } = input || {};
    const { data, error } = validateLegalUpdate(fields);
    if (error) return ctx.badRequest(error);

    const next: Record<string, unknown> = {};
    if (data.title) next.title = mergeLocalized(doc.title, data.title as any);
    if (data.body) {
      next.body = mergeLocalized(doc.body, data.body as any);
      if (!availableLanguages(next.body).length) return ctx.badRequest('Document must keep text in at least one language');
    }
    if ('revisionDate' in data) next.revisionDate = data.revisionDate;

    const updated: any = await strapi.documents(UID).update({ documentId: doc.documentId, data: next } as any);
    strapi.log.info(`[legal-document] "${doc.slug}" updated by user ${ctx.state.user?.id}: ${Object.keys(next).join(', ')}`);
    ctx.body = {
      data: {
        slug: updated.slug,
        title: updated.title || {},
        body: updated.body || {},
        revisionDate: updated.revisionDate || null,
        updatedAt: updated.updatedAt,
      },
    };
  },
}));
