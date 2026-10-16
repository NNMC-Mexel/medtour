/**
 * Правовые документы. Чтение публичное; правка — только админ.
 * Core CRUD не подключаем: документы нельзя создать или удалить через API.
 */
export default {
  routes: [
    { method: 'GET', path: '/legal-documents', handler: 'legal-document.list', config: { auth: false } },
    { method: 'GET', path: '/legal-documents/:slug', handler: 'legal-document.findBySlug', config: { auth: false } },
    { method: 'GET', path: '/legal-documents/:slug/edit', handler: 'legal-document.findForEdit', config: { policies: ['global::is-admin'] } },
    { method: 'PUT', path: '/legal-documents/:slug', handler: 'legal-document.updateBySlug', config: { policies: ['global::is-admin'] } },
  ],
};
