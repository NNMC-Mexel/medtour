'use strict';

// Loading Strapi runs bootstrap. Suppress auto import so --dry-run stays read-only.
process.env.PRICE_CATALOG_IMPORT_MANUAL_RUN = '1';

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();
  const { importPriceCatalog } = require('../dist/src/utils/price-catalog-import');
  try {
    console.log(await importPriceCatalog(app, { dryRun: process.argv.includes('--dry-run') }));
  } finally {
    await app.destroy();
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
