export default {
  routes: [
    {
      method: 'GET',
      path: '/turn-credentials',
      handler: 'turn-credential.issue',
      // Token is checked in the controller: every signed-in role needs relay credentials.
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
