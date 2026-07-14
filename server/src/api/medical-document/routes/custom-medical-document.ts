/**
 * Custom routes for medical-document sharing.
 * IMPORTANT: /my-doctors MUST come before /:id routes to avoid being matched as findOne.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/medical-cases/:caseId/documents',
      handler: 'medical-document.byCase',
      info: {
        apiName: 'medical-document',
        type: 'content-api',
      },
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/medical-cases/:caseId/documents/:id/attach',
      handler: 'medical-document.attachToCase',
      info: {
        apiName: 'medical-document',
        type: 'content-api',
      },
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/medical-documents/my-doctors',
      handler: 'medical-document.myDoctors',
      info: {
        apiName: 'medical-document',
        type: 'content-api',
      },
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/medical-documents/:id/share',
      handler: 'medical-document.share',
      info: {
        apiName: 'medical-document',
        type: 'content-api',
      },
      config: {
        policies: [],
      },
    },
  ],
};
