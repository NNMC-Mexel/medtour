'use strict';

/** Idempotent catalog import. Existing sourceKey rows are never overwritten. */
const fs = require('node:fs');
const path = require('node:path');

const dryRun = process.argv.includes('--dry-run');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/price-catalog-2026-08-24.json'), 'utf8'));

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();
  const { getUsdRate, convertKztToUsd } = require('../dist/src/utils/nbk-rate');
  try {
    const uid = 'api::price-item.price-item';
    const store = app.store({ type: 'core', name: 'nnmc-price-import' });
    const completed = await store.get({ key: 'paid-2026-08-24' });
    if (completed) {
      console.log('This catalog was already imported. Existing edits and deletions are preserved.');
      return;
    }
    const existing = await app.documents(uid).findMany({ status: 'published', limit: 10000, fields: ['documentId', 'sourceKey', 'price', 'priceUSD', 'currency', 'title'] });
    const keys = new Set(existing.map((item) => item.sourceKey).filter(Boolean));
    const pending = catalog.items.filter((item) => !keys.has(item.sourceKey));
    const legacy = existing.filter((item) => item.currency === 'KZT');
    console.log(`Catalog: ${catalog.items.length}; existing: ${existing.length}; to add: ${pending.length}; legacy KZT: ${legacy.length}`);
    if (dryRun) return;
    const rate = pending.length || legacy.length ? await getUsdRate() : null;
    if (rate) console.log(`Using NBK rate ${rate.kztPerUsd} KZT/USD dated ${rate.date}`);
    for (const item of legacy) {
      const usd = convertKztToUsd(Number(item.price), rate.kztPerUsd);
      await app.documents(uid).update({ documentId: item.documentId, status: 'published', data: {
        priceKZT: Number(item.price), price: usd, priceUSD: usd, currency: 'USD',
        exchangeRate: rate.kztPerUsd, exchangeRateDate: rate.date,
      } });
    }
    for (let index = 0; index < pending.length; index++) {
      const item = pending[index];
      const price = convertKztToUsd(Number(item.priceKZT), rate.kztPerUsd);
      await app.documents(uid).create({ data: {
        ...item, price, priceUSD: price, exchangeRate: rate.kztPerUsd, exchangeRateDate: rate.date,
      }, status: 'published' });
      if ((index + 1) % 100 === 0 || index + 1 === pending.length) console.log(`Imported ${index + 1}/${pending.length}`);
    }
    const count = await app.documents(uid).count({ status: 'published' });
    await store.set({ key: 'paid-2026-08-24', value: { completedAt: new Date().toISOString(), imported: catalog.items.length } });
    console.log(`Published price items: ${count}`);
  } finally {
    await app.destroy();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
