'use strict';

const required = [
  'PORT',
  'CORS_ORIGINS',
  'SIGNALING_PUBLIC_URL',
  'STRAPI_API_URL',
  'STRAPI_API_TOKEN',
];

const paymentKeys = [
  'EPAY_CLIENT_ID',
  'EPAY_CLIENT_SECRET',
  'EPAY_TERMINAL_ID',
  'EPAY_QR_CLIENT_ID',
  'EPAY_QR_CLIENT_SECRET',
  'EPAY_QR_TERMINAL_ID',
];

console.log('=== Signaling production env check ===\n');

let failed = false;
for (const key of required) {
  if (!process.env[key]) {
    failed = true;
    console.error(`  [FAIL] ${key} is missing`);
  } else {
    console.log(`  [OK] ${key}`);
  }
}

if (process.env.NODE_ENV === 'production') {
  const freeConsultations = process.env.FREE_CONSULTATIONS !== 'false';
  const allowTestPaymentsInProduction = process.env.ALLOW_TEST_PAYMENTS_IN_PRODUCTION === 'true';
  if (!freeConsultations && process.env.PAYMENTS_LIVE !== 'true' && !allowTestPaymentsInProduction) {
    failed = true;
    console.error('  [FAIL] PAYMENTS_LIVE=true is required in production unless FREE_CONSULTATIONS=true or ALLOW_TEST_PAYMENTS_IN_PRODUCTION=true');
  } else if (!freeConsultations && process.env.PAYMENTS_LIVE !== 'true') {
    console.warn('  [WARN] Test payments are enabled in production; Halyk live payments are disabled');
  }
  const requiredOrigins = [
    'https://medtour.nnmc.kz',
    'https://medtourserver.nnmc.kz',
    'https://medtoursignaling.nnmc.kz',
  ];
  for (const origin of requiredOrigins) {
    if (!process.env.CORS_ORIGINS?.includes(origin)) {
      failed = true;
      console.error(`  [FAIL] CORS_ORIGINS must include ${origin}`);
    }
  }
  if (!freeConsultations && process.env.PAYMENTS_LIVE === 'true') {
    for (const key of paymentKeys) {
      if (!process.env[key]) {
        failed = true;
        console.error(`  [FAIL] ${key} is required when PAYMENTS_LIVE=true`);
      } else {
        console.log(`  [OK] ${key}`);
      }
    }
  }
}

if (process.env.REDIS_URL) console.log('  [OK] REDIS_URL configured for Socket.IO adapter');
else console.log('  [WARN] REDIS_URL not set; Socket.IO presence is single-instance only');

if (failed) process.exit(1);
console.log('\nSignaling env check OK.');
