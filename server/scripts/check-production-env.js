'use strict';

const required = [
  'NODE_ENV',
  'HOST',
  'PORT',
  'SERVER_URL',
  'FRONTEND_URLS',
  'APP_KEYS',
  'API_TOKEN_SALT',
  'ADMIN_JWT_SECRET',
  'TRANSFER_TOKEN_SALT',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_CLIENT',
];

const productionRequired = [
  'DATABASE_URL',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
];

const insecureValues = new Set(['', 'toBeModified1,toBeModified2', 'tobemodified', 'changeme', 'change-me']);

function fail(message) {
  console.error(`  [FAIL] ${message}`);
  process.exitCode = 1;
}

console.log('=== Strapi production env check ===\n');

for (const key of required) {
  const value = process.env[key];
  if (!value) fail(`${key} is missing`);
  else if (insecureValues.has(String(value).replace(/^"|"$/g, ''))) fail(`${key} still has an insecure placeholder`);
  else console.log(`  [OK] ${key}`);
}

if (process.env.NODE_ENV === 'production') {
  if (process.env.DATABASE_CLIENT !== 'postgres') fail('DATABASE_CLIENT must be postgres in production');
  if (process.env.PAYMENTS_LIVE !== 'true') fail('PAYMENTS_LIVE=true is required in production');
  for (const key of productionRequired) {
    if (!process.env[key]) fail(`${key} is required in production`);
    else console.log(`  [OK] ${key}`);
  }
}

if (process.exitCode) {
  console.error('\nStrapi env check failed.');
  process.exit(process.exitCode);
}

console.log('\nStrapi env check OK.');
