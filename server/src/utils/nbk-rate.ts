/** Official NBK rate: KZT for one USD. Published daily, not an intraday quote. */
export type UsdRate = { kztPerUsd: number; date: string; source: string };

let cached: { value: UsdRate; until: number } | null = null;
const SOURCE = 'https://nationalbank.kz/rss/rates_all.xml';

export async function getUsdRate(): Promise<UsdRate> {
  if (cached && cached.until > Date.now()) return cached.value;
  const response = await fetch(SOURCE, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`NBK returned ${response.status}`);
  const xml = await response.text();
  const item = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .find((match) => /<title>\s*USD\s*<\/title>/.test(match[1]))?.[1];
  if (!item) throw new Error('USD rate is missing from NBK feed');
  const value = Number(item.match(/<description>\s*([\d.,]+)\s*<\/description>/)?.[1]?.replace(',', '.'));
  const quantity = Number(item.match(/<quant>\s*(\d+)\s*<\/quant>/)?.[1] || 1);
  const published = item.match(/<pubDate>\s*(\d{2})\.(\d{2})\.(\d{4})\s*<\/pubDate>/);
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(quantity) || quantity <= 0 || !published) {
    throw new Error('Invalid USD rate from NBK');
  }
  const date = `${published[3]}-${published[2]}-${published[1]}`;
  const ageDays = (Date.now() - new Date(`${date}T00:00:00+05:00`).getTime()) / 86400000;
  if (ageDays > 5 || ageDays < -2) throw new Error('NBK rate is stale or dated in the future');
  const rate = { kztPerUsd: value / quantity, date, source: SOURCE };
  cached = { value: rate, until: Date.now() + 30 * 60 * 1000 };
  return rate;
}

export function convertKztToUsd(kzt: number, rate: number) {
  return Math.round((kzt / rate + Number.EPSILON) * 100) / 100;
}
