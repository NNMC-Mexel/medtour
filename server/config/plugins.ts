export default ({ env }) => {
  const storageEndpoint = env('MINIO_ENDPOINT', env('S3_ENDPOINT'));
  const storageAccessKey = env('MINIO_ACCESS_KEY', env('S3_ACCESS_KEY_ID'));
  const storageSecretKey = env('MINIO_SECRET_KEY', env('S3_ACCESS_SECRET'));
  const storageBucket = env('MINIO_BUCKET', env('S3_BUCKET'));
  const serverUrl = env('SERVER_URL', env('STRAPI_URL', 'http://localhost:1340'));
  const smtpFrom = env('SMTP_FROM', env('SMTP_USER'));
  const smtpFromName = env('SMTP_FROM_NAME', 'MedTour');

  return ({
  'users-permissions': {
    config: {
      register: {
        allowedFields: ['userRole', 'fullName', 'phone', 'iin', 'doctorData'],
      },
      // URL фронтенда для сброса пароля (Strapi подставит ?code=XXX)
      resetPasswordURL: env('FRONTEND_URL', 'http://localhost:5173') + '/reset-password',
    },
  },

  // Email provider (Yandex SMTP via nodemailer)
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.yandex.ru'),
        port: env.int('SMTP_PORT', 465),
        // 465 — сразу TLS, 587 — STARTTLS. Жёсткое secure: true на 587 вешало
        // соединение до таймаута.
        secure: env.bool('SMTP_SECURE', env.int('SMTP_PORT', 465) === 465),
        // Без таймаутов nodemailer ждёт соединения 2 минуты, а сокет — 10:
        // если исходящий SMTP недоступен, регистрация и «Забыли пароль?»
        // висели на «Загрузка…». Теперь сбой почты виден через ~15 с, а эти
        // формы его обрабатывают (аккаунт создаётся, ответ — как обычно).
        connectionTimeout: env.int('SMTP_CONNECTION_TIMEOUT_MS', 10_000),
        greetingTimeout: env.int('SMTP_GREETING_TIMEOUT_MS', 10_000),
        socketTimeout: env.int('SMTP_SOCKET_TIMEOUT_MS', 20_000),
        auth: {
          user: env('SMTP_USER'),
          pass: env('SMTP_PASS'),
        },
      },
      settings: {
        defaultFrom: smtpFrom ? `${smtpFromName} <${smtpFrom}>` : undefined,
        defaultReplyTo: smtpFrom,
      },
    },
  },

  // Upload provider: 'aws-s3' for MinIO/S3-compatible storage or default local storage.
  ...(storageEndpoint ? {
    upload: {
      config: {
        provider: 'aws-s3',
        providerOptions: {
          baseUrl: `${serverUrl}/api/file-proxy`,
          s3Options: {
            credentials: {
              accessKeyId: storageAccessKey,
              secretAccessKey: storageSecretKey,
            },
            region: env('S3_REGION', 'us-east-1'),
            endpoint: storageEndpoint,
            forcePathStyle: true,
            params: { Bucket: storageBucket },
          },
        },
        actionOptions: { upload: {}, uploadStream: {}, delete: {} },
      },
    },
  } : {}),
  });
};
