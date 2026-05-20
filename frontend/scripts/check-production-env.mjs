const required = [
  'VITE_API_URL',
  'VITE_SIGNALING_SERVER',
  'VITE_PRODUCTION_API_URL',
  'VITE_PRODUCTION_SIGNALING_URL',
  'VITE_PRODUCTION_FRONTEND_HOSTS',
]

console.log('=== Frontend production env check ===\n')

let failed = false
for (const key of required) {
  if (!process.env[key]) {
    failed = true
    console.error(`  [FAIL] ${key} is missing`)
  } else {
    console.log(`  [OK] ${key}`)
  }
}

if (process.env.NODE_ENV === 'production') {
  if (process.env.VITE_PAYMENTS_LIVE !== 'true') {
    failed = true
    console.error('  [FAIL] VITE_PAYMENTS_LIVE=true is required in production')
  }
  if (process.env.VITE_EPAY_TEST !== 'false') {
    failed = true
    console.error('  [FAIL] VITE_EPAY_TEST=false is required in production')
  }
}

if (failed) process.exit(1)
console.log('\nFrontend env check OK.')
