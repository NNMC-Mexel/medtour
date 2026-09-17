/**
 * Price item routes.
 * find/findOne are controlled by role permissions; staff may edit prices.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::price-item.price-item', {
  config: {
    create: {
      policies: ['global::is-price-editor'],
    },
    update: {
      policies: ['global::is-price-editor'],
    },
    delete: {
      policies: ['global::is-price-editor'],
    },
  },
});
