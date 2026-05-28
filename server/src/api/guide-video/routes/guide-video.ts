/**
 * Guide video routes.
 * Patients can read active guide content; mutations are admin-only.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::guide-video.guide-video', {
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
