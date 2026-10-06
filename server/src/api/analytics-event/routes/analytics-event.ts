/**
 * Только два маршрута: стандартный CRUD для событий аналитики не открывается.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/analytics/collect',
      handler: 'analytics-event.collect',
      config: {
        // Сбор анонимный: пишут и гости лендинга, и пациенты в кабинете.
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/summary',
      handler: 'analytics-event.summary',
      config: {
        policies: ['global::is-admin'],
      },
    },
  ],
};
