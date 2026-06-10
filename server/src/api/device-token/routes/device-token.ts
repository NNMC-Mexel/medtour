export default {
  routes: [
    {
      method: 'POST',
      path: '/device-tokens/register',
      handler: 'device-token.register',
      info: { apiName: 'device-token', type: 'content-api' },
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/device-tokens/unregister',
      handler: 'device-token.unregister',
      info: { apiName: 'device-token', type: 'content-api' },
      config: { policies: [] },
    },
  ],
};
