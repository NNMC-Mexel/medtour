import cronTasks from './cron-tasks';

export default ({ env }) => {
  const isProduction =
    process.env.NODE_ENV === 'production' || env('NODE_ENV') === 'production';

  // Локально Strapi работает на 1340, в продакшене на отдельном домене
  const localPort = 1340;

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', localPort),
    // За Coolify/Traefik без этого ctx.request.ip — адрес прокси: все клиенты
    // делят один счётчик попыток входа, а в логах один IP на всех.
    // Strapi 5 читает именно server.proxy.koa. maxIpsCount — сколько последних
    // адресов X-Forwarded-For дописали наши прокси: берём адрес от ближайшего
    // из них, а не первый в заголовке — первый присылает сам клиент.
    // Coolify (только Traefik) — 1; если впереди ещё Nginx/CDN — 2.
    proxy: {
      koa: env.bool('IS_PROXIED', isProduction),
      maxIpsCount: env.int('PROXY_MAX_IPS_COUNT', 1),
    },
    app: {
      keys: env.array('APP_KEYS'),
    },
    // Production: https://medtourserver.nnmc.kz
    // Development: http://localhost:1340
    url: env(
      'SERVER_URL',
      isProduction
        ? 'https://medtourserver.nnmc.kz'
        : `http://localhost:${localPort}`
    ),
    cron: {
      enabled: env.bool('CRON_ENABLED', true),
      tasks: cronTasks,
    },
  };
};
