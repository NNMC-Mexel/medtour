export default ({ env }) => {
  const isProduction = process.env.NODE_ENV === 'production' || env('NODE_ENV') === 'production';
  const productionOrigins = env.array('FRONTEND_URLS', [
    env('FRONTEND_URL', 'https://medtour.nnmc.kz'),
    'https://www.medtour.nnmc.kz',
    'https://medtourserver.nnmc.kz',
    'https://medtoursignaling.nnmc.kz',
  ]);
  
  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:'],
            'img-src': [
              "'self'",
              'data:',
              'blob:',
              'market-assets.strapi.io',
              // Always reference files via the file-proxy on the API origin,
              // never via the internal MinIO endpoint (was leaking 192.168.x.x).
              env('SERVER_URL', env('STRAPI_URL', 'http://localhost:1340')),
            ],
            'media-src': [
              "'self'",
              'data:',
              'blob:',
              env('SERVER_URL', env('STRAPI_URL', 'http://localhost:1340')),
            ],
            upgradeInsecureRequests: null,
          },
        },
        // HSTS: tell browsers to always use HTTPS for 2 years
        hsts: isProduction
          ? { maxAge: 63072000, includeSubDomains: true, preload: true }
          : false,
      },
    },
    {
      name: 'strapi::cors',
      config: {
        // Explicit allowed headers — never use '*'
        headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
        maxAge: 7200,
        origin: isProduction
          ? productionOrigins
          : [
              'http://localhost:5173',
              'http://localhost:3000',
              'http://localhost:1342',
              'http://localhost:1343',
              'http://localhost:1347',
            ],
      },
    },
    {
      name: 'global::rate-limit',
      config: {
        trustProxy: env.bool('RATE_LIMIT_TRUST_PROXY', isProduction),
        limits: {
          '/api/auth/local': {
            max: env.int('AUTH_LOGIN_RATE_LIMIT_MAX', 60),
            windowMs: env.int('AUTH_LOGIN_RATE_LIMIT_WINDOW_MINUTES', 15) * 60 * 1000,
          },
          '/api/auth/local/register': {
            max: env.int('AUTH_REGISTER_RATE_LIMIT_MAX', 300),
            windowMs: env.int('AUTH_REGISTER_RATE_LIMIT_WINDOW_MINUTES', 60) * 60 * 1000,
          },
          '/api/auth/forgot-password': {
            max: env.int('AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX', 20),
            windowMs: env.int('AUTH_FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MINUTES', 60) * 60 * 1000,
          },
        },
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    // Upload guard MUST come after strapi::body so files are parsed,
    // and before strapi::session so we reject early.
    { name: 'global::upload-guard', config: {} },
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
