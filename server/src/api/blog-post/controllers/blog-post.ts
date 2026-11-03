/**
 * Статьи блога: публичные /blog и /blog/:slug и раздел «Блог / Статьи» в админке.
 *
 * Тексты хранятся по языкам ({ ru, kk, en }); пустой язык на сайте заменяется
 * русским. Список для сайта отдаётся без текста статьи — только флаг hasContent.
 */

import { factories } from '@strapi/strapi';
import { pickText, slugify, validateBlogPost } from '../../../utils/blog-posts';

const UID = 'api::blog-post.blog-post' as any;
const SORT = ['sortOrder:asc', 'createdAt:desc'];

const hasText = (map: any) => Boolean(map) && Object.values(map).some((text) => typeof text === 'string' && text.trim());

function serialize(post: any, { withContent = true } = {}) {
  const cover = post.cover
    ? { id: post.cover.id, url: post.cover.url, name: post.cover.name, alternativeText: post.cover.alternativeText || null }
    : null;
  return {
    id: post.id,
    documentId: post.documentId,
    slug: post.slug,
    title: post.title || {},
    excerpt: post.excerpt || {},
    ...(withContent ? { content: post.content || {} } : {}),
    hasContent: hasText(post.content),
    category: post.category,
    readTime: post.readTime ?? null,
    cover,
    coverUrl: post.coverUrl || null,
    isActive: post.isActive !== false,
    isFeatured: Boolean(post.isFeatured),
    sortOrder: post.sortOrder || 0,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

const findBySlug = (strapi: any, slug: string) =>
  strapi.documents(UID).findFirst({ filters: { slug }, populate: { cover: true } } as any);

/** Явно указанный slug должен быть свободен; созданный из заголовка — получает суффикс -2, -3… */
async function resolveSlug(strapi: any, requested: string, title: any, ownDocumentId?: string) {
  const isTaken = async (slug: string) => {
    const existing: any = await findBySlug(strapi, slug);
    return Boolean(existing) && existing.documentId !== ownDocumentId;
  };
  if (requested) return (await isTaken(requested)) ? { error: 'slug is already used by another article' } : { slug: requested };
  const base = slugify(pickText(title, 'en')) || slugify(pickText(title)) || 'post';
  for (let index = 1; index < 100; index += 1) {
    const slug = index === 1 ? base : `${base}-${index}`;
    if (!(await isTaken(slug))) return { slug };
  }
  return { slug: `${base}-${Date.now()}` };
}

/** Главная статья блога одна: отметка на новой снимается с остальных. */
async function clearOtherFeatured(strapi: any, documentId: string) {
  await strapi.db.query(UID).updateMany({
    where: { isFeatured: true, documentId: { $ne: documentId } },
    data: { isFeatured: false },
  });
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  /** GET /blog-posts — активные статьи для сайта, без текста. */
  async list(ctx) {
    const posts = await strapi.documents(UID).findMany({
      filters: { isActive: true },
      sort: SORT,
      populate: { cover: true },
    } as any);
    ctx.body = { data: posts.map((post: any) => serialize(post, { withContent: false })) };
  },

  /** GET /blog-posts/:slug — одна активная статья целиком. */
  async findBySlug(ctx) {
    const post: any = await findBySlug(strapi, String(ctx.params.slug || ''));
    if (!post || post.isActive === false) return ctx.notFound('Article not found');
    ctx.body = { data: serialize(post) };
  },

  /** GET /blog-posts/manage — все статьи, включая скрытые (только админ). */
  async manage(ctx) {
    const posts = await strapi.documents(UID).findMany({ sort: SORT, populate: { cover: true } } as any);
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data: posts.map((post: any) => serialize(post)) };
  },

  async create(ctx) {
    const body = (ctx.request.body as any)?.data ?? ctx.request.body;
    const { data, error } = validateBlogPost(body);
    if (error) return ctx.badRequest(error);
    const { slug, error: slugError } = await resolveSlug(strapi, String(data.slug || ''), data.title);
    if (slugError) return ctx.badRequest(slugError);
    const post: any = await strapi.documents(UID).create({ data: { ...data, slug }, populate: { cover: true } } as any);
    if (post.isFeatured) await clearOtherFeatured(strapi, post.documentId);
    ctx.body = { data: serialize(post) };
  },

  async update(ctx) {
    const documentId = String(ctx.params.id || '');
    const existing: any = await strapi.documents(UID).findOne({ documentId } as any);
    if (!existing) return ctx.notFound('Article not found');
    const body = (ctx.request.body as any)?.data ?? ctx.request.body;
    const { data, error } = validateBlogPost(body, { partial: true });
    if (error) return ctx.badRequest(error);
    if ('slug' in data) {
      const { slug, error: slugError } = await resolveSlug(strapi, String(data.slug || ''), data.title || existing.title, documentId);
      if (slugError) return ctx.badRequest(slugError);
      data.slug = slug;
    }
    const post: any = await strapi.documents(UID).update({ documentId, data, populate: { cover: true } } as any);
    if (data.isFeatured) await clearOtherFeatured(strapi, documentId);
    ctx.body = { data: serialize(post) };
  },

  async delete(ctx) {
    const documentId = String(ctx.params.id || '');
    const existing = await strapi.documents(UID).findOne({ documentId } as any);
    if (!existing) return ctx.notFound('Article not found');
    await strapi.documents(UID).delete({ documentId } as any);
    ctx.body = { data: { documentId } };
  },
}));
