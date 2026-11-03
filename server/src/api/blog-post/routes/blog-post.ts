/**
 * Статьи блога. Чтение публичное (только активные); список для админки и
 * правка — только админ. /manage объявлен до /:slug, иначе его перехватит slug.
 */
export default {
  routes: [
    { method: 'GET', path: '/blog-posts', handler: 'blog-post.list', config: { auth: false } },
    { method: 'GET', path: '/blog-posts/manage', handler: 'blog-post.manage', config: { policies: ['global::is-admin'] } },
    { method: 'GET', path: '/blog-posts/:slug', handler: 'blog-post.findBySlug', config: { auth: false } },
    { method: 'POST', path: '/blog-posts', handler: 'blog-post.create', config: { policies: ['global::is-admin'] } },
    { method: 'PUT', path: '/blog-posts/:id', handler: 'blog-post.update', config: { policies: ['global::is-admin'] } },
    { method: 'DELETE', path: '/blog-posts/:id', handler: 'blog-post.delete', config: { policies: ['global::is-admin'] } },
  ],
};
