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
  // PII encryption-at-rest for iin/passportNumber (RK Law 94-V art.10).
  // Without it those fields are stored in plaintext — not acceptable in prod.
  'PII_ENCRYPTION_KEY',
];

const insecureValues = new Set(['', 'toBeModified1,toBeModified2', 'tobemodified', 'changeme', 'change-me']);

// A valid PII key is 32 bytes, supplied as 64 hex chars OR base64 (mirrors
// src/utils/pii-crypto.ts getKey()).
function isValidPiiKey(raw) {
  if (!raw) return false;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return true;
  try {
    return Buffer.from(raw, 'base64').length === 32;
  } catch {
    return false;
  }
}

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
  const allowTestPaymentsInProduction = process.env.ALLOW_TEST_PAYMENTS_IN_PRODUCTION === 'true';
  if (process.env.PAYMENTS_LIVE !== 'true' && !allowTestPaymentsInProduction) {
    fail('PAYMENTS_LIVE=true is required in production unless ALLOW_TEST_PAYMENTS_IN_PRODUCTION=true');
  } else if (process.env.PAYMENTS_LIVE !== 'true') {
    console.warn('  [WARN] Test payments are enabled in production; live payment enforcement is disabled');
  }
  const requiredOrigins = [
    'https://medtour.nnmc.kz',
    'https://medtourserver.nnmc.kz',
    'https://medtoursignaling.nnmc.kz',
  ];
  for (const origin of requiredOrigins) {
    if (!process.env.FRONTEND_URLS?.includes(origin)) fail(`FRONTEND_URLS must include ${origin}`);
  }
  for (const key of productionRequired) {
    if (!process.env[key]) fail(`${key} is required in production`);
    else console.log(`  [OK] ${key}`);
  }

  // PII_ENCRYPTION_KEY must not only be present but be a usable 32-byte key,
  // otherwise pii-crypto silently falls back to plaintext storage.
  const piiKey = (process.env.PII_ENCRYPTION_KEY || '').replace(/^"|"$/g, '');
  if (piiKey && !isValidPiiKey(piiKey)) {
    fail('PII_ENCRYPTION_KEY must be 32 bytes as 64 hex chars or base64 (openssl rand -hex 32)');
  }
}

if (process.exitCode) {
  console.error('\nStrapi env check failed.');
  process.exit(process.exitCode);
}

console.log('\nStrapi env check OK.');
