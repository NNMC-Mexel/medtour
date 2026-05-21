/**
 * Price item routes.
 * find/findOne are controlled by role permissions; mutations are admin-only.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::price-item.price-item', {
  config: {
    create: {
      policies: ['global::is-admin'],
    },
    update: {
      policies: ['global::is-admin'],
    },
    delete: {
      policies: ['global::is-admin'],
    },
  },
});
