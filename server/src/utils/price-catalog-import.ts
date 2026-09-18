import fs from 'node:fs';
import path from 'node:path';
import { convertKztToUsd, getUsdRate } from './nbk-rate';

const uid = 'api::price-item.price-item';
const importKey = 'paid-2026-08-24';

type CatalogItem = { sourceKey: string; priceKZT: number; [key: string]: unknown };
type Catalog = { items: CatalogItem[] };
type Rate = { kztPerUsd: number; date: string };

export function loadPriceCatalog(): Catalog {
  const file = path.resolve(process.cwd(), 'data/price-catalog-2026-08-24.json');
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8')) as Catalog;
  if (!Array.isArray(catalog.items) || catalog.items.length === 0) throw new Error('Price catalog is empty');
  const keys = new Set(catalog.items.map((item) => item.sourceKey));
  if (keys.size !== catalog.items.length || keys.has(undefined as unknown as string)) {
    throw new Error('Price catalog has missing or duplicate source keys');
  }
  return catalog;
}

/** Import once per database. A successful import marker protects later staff edits and deletions. */
export async function importPriceCatalog(
  strapi: any,
  options: { dryRun?: boolean; catalog?: Catalog; getRate?: () => Promise<Rate> } = {},
) {
  const store = strapi.store({ type: 'core', name: 'nnmc-price-import' });
  if (await store.get({ key: importKey })) {
    strapi.log?.info?.('Price catalog was already imported; preserving staff changes.');
    return { alreadyCompleted: true, pending: 0, imported: 0, legacyConverted: 0 };
  }

  const catalog = options.catalog ?? loadPriceCatalog();

  const documents = strapi.documents(uid);
  const fields = ['documentId', 'sourceKey', 'price', 'priceUSD', 'currency', 'title'];
  const [published, drafts] = await Promise.all([
    documents.findMany({ status: 'published', limit: 10000, fields }),
    documents.findMany({ status: 'draft', limit: 10000, fields }),
  ]);
  const existingKeys = new Set([...published, ...drafts].map((item) => item.sourceKey).filter(Boolean));
  const pending = catalog.items.filter((item) => !existingKeys.has(item.sourceKey));
  const legacy = published.filter((item) => item.currency === 'KZT');
  strapi.log?.info?.(`Price catalog: ${catalog.items.length} source rows, ${pending.length} pending, ${legacy.length} legacy KZT rows.`);
  if (options.dryRun) {
    return { alreadyCompleted: false, pending: pending.length, imported: 0, legacyConverted: 0 };
  }

  const rate = pending.length || legacy.length ? await (options.getRate ?? getUsdRate)() : null;
  if (rate) strapi.log?.info?.(`Price catalog import using NBK rate ${rate.kztPerUsd} KZT/USD dated ${rate.date}.`);
  for (const item of legacy) {
    const kzt = Number(item.price);
    if (!Number.isFinite(kzt) || kzt < 0) throw new Error(`Invalid legacy KZT price for ${item.documentId}`);
    const usd = convertKztToUsd(kzt, rate!.kztPerUsd);
    await documents.update({ documentId: item.documentId, status: 'published', data: {
      priceKZT: kzt, price: usd, priceUSD: usd, currency: 'USD',
      exchangeRate: rate!.kztPerUsd, exchangeRateDate: rate!.date,
    } });
  }
  for (let index = 0; index < pending.length; index++) {
    const item = pending[index];
    const kzt = Number(item.priceKZT);
    if (!Number.isFinite(kzt) || kzt < 0) throw new Error(`Invalid KZT price for ${item.sourceKey}`);
    const usd = convertKztToUsd(kzt, rate!.kztPerUsd);
    await documents.create({ data: {
      ...item, price: usd, priceUSD: usd, currency: 'USD',
      exchangeRate: rate!.kztPerUsd, exchangeRateDate: rate!.date,
    }, status: 'published' });
    if ((index + 1) % 100 === 0 || index + 1 === pending.length) {
      strapi.log?.info?.(`Price catalog imported ${index + 1}/${pending.length} pending rows.`);
    }
  }
  const count = await documents.count({ status: 'published' });
  await store.set({ key: importKey, value: {
    completedAt: new Date().toISOString(), imported: catalog.items.length,
  } });
  strapi.log?.info?.(`Price catalog import complete. Published price items: ${count}.`);
  return { alreadyCompleted: false, pending: pending.length, imported: pending.length, legacyConverted: legacy.length, published: count };
}
