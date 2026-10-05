export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/logout',
      handler: 'session.logout',
      // Маршрут проверяет токен сам: выход нужен всем ролям, и забытый грант
      // в users-permissions означал бы, что пользователь не может завершить сессию.
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
