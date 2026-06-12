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
        secure: true,
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
