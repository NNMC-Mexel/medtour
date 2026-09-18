'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importPriceCatalog } = require('../dist/src/utils/price-catalog-import.js');

const catalog = {
  items: [
    { sourceKey: 'sheet-1-row-1', title: 'Service A', category: 'Analysis', priceKZT: 1000, currency: 'USD', isActive: true },
    { sourceKey: 'sheet-1-row-2', title: 'Service B', category: 'Check-up', priceKZT: 2500, currency: 'USD', isActive: true },
  ],
};

function fakeStrapi(initial = []) {
  const rows = initial.map((row) => ({ ...row }));
  let marker = null;
  let nextId = rows.length + 1;
  const api = {
    rows,
    documents() {
      return {
        async findMany({ status }) {
          return rows.filter((row) => row.status === status).map((row) => ({ ...row }));
        },
        async create({ data, status }) {
          const row = { ...data, status, documentId: `doc-${nextId++}` };
          rows.push(row);
          return row;
        },
        async update({ documentId, data }) {
          const row = rows.find((candidate) => candidate.documentId === documentId);
          Object.assign(row, data);
          return row;
        },
        async count({ status }) {
          return rows.filter((row) => row.status === status).length;
        },
      };
    },
    store() {
      return {
        async get() { return marker; },
        async set({ value }) { marker = value; },
      };
    },
    get marker() { return marker; },
  };
  return api;
}

const getRate = async () => ({ kztPerUsd: 500, date: '2026-09-18' });

test('imports missing services and converts existing KZT entries once', async () => {
  const app = fakeStrapi([{ documentId: 'legacy', status: 'published', title: 'Old price', price: 5000, currency: 'KZT' }]);

  const result = await importPriceCatalog(app, { catalog, getRate });

  assert.equal(result.imported, 2);
  assert.equal(result.legacyConverted, 1);
  assert.equal(app.rows.find((row) => row.documentId === 'legacy').price, 10);
  assert.equal(app.rows.find((row) => row.sourceKey === 'sheet-1-row-1').price, 2);
  assert.equal(app.rows.find((row) => row.sourceKey === 'sheet-1-row-2').price, 5);
  assert.equal(app.marker.imported, 2);

  app.rows.find((row) => row.sourceKey === 'sheet-1-row-1').price = 99;
  app.rows.splice(app.rows.findIndex((row) => row.sourceKey === 'sheet-1-row-2'), 1);
  const again = await importPriceCatalog(app, { catalog, getRate: async () => { throw new Error('rate must not be fetched'); } });
  assert.equal(again.alreadyCompleted, true);
  assert.equal(app.rows.find((row) => row.sourceKey === 'sheet-1-row-1').price, 99);
  assert.equal(app.rows.some((row) => row.sourceKey === 'sheet-1-row-2'), false);
});

test('a partial import resumes missing rows without overwriting prior rows', async () => {
  const app = fakeStrapi([{ documentId: 'existing', status: 'published', sourceKey: 'sheet-1-row-1', price: 77, currency: 'USD' }]);
  const result = await importPriceCatalog(app, { catalog, getRate });

  assert.equal(result.imported, 1);
  assert.equal(app.rows.find((row) => row.sourceKey === 'sheet-1-row-1').price, 77);
  assert.equal(app.rows.find((row) => row.sourceKey === 'sheet-1-row-2').price, 5);
});

test('dry run reports pending rows without writing or storing completion', async () => {
  const app = fakeStrapi([{ documentId: 'draft', status: 'draft', sourceKey: 'sheet-1-row-1', price: 88, currency: 'USD' }]);
  const result = await importPriceCatalog(app, { catalog, getRate, dryRun: true });

  assert.equal(result.pending, 1);
  assert.equal(app.rows.length, 1);
  assert.equal(app.marker, null);
});

test('completed import does not need the bundled file on later deployments', async () => {
  const app = fakeStrapi();
  await importPriceCatalog(app, { catalog, getRate });
  const previousDirectory = process.cwd();
  const emptyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'price-import-test-'));
  try {
    process.chdir(emptyDirectory);
    const result = await importPriceCatalog(app);
    assert.equal(result.alreadyCompleted, true);
  } finally {
    process.chdir(previousDirectory);
    fs.rmSync(emptyDirectory, { recursive: true, force: true });
  }
});
