# International price catalog

The source is `ПРЕЙСКУРАНТ с 24.08.xlsx`, supplied by NNMC. Its two **paid** sheets contain 1,751 and 131 priced services. The two insurance sheets contain the same numbers of services at insurance tariffs and are excluded from the public international catalog. The public tariff uses column G, labelled for patients from countries outside the near abroad. This tariff choice should be reviewed if a separate CIS price is required.

The committed [catalog](../server/data/price-catalog-2026-08-24.json) contains 1,882 services. Each row keeps the workbook sheet/row identifier, original KZT amount, tariff code, USD amount, exchange rate, and rate date. Its USD snapshot used the [National Bank of Kazakhstan's official USD/KZT rate](https://nationalbank.kz/ru/page/RSS) of **444.88 KZT for 1 USD on 2026-09-17**, rounded to USD cents. The actual import recalculates USD using the official rate current on the import day and stores that rate/date on every row. The original workbook is not committed.

## Deployment

On the next production Strapi startup, the server imports the bundled catalog in the background. No extra Coolify command is needed. The process logs progress after every 100 rows, then stores the `paid-2026-08-24` completion marker in the production database. Later deployments see that marker and skip the import, preserving staff edits and deletions. A failed partial import retries after 15 minutes and only adds source rows still missing; it does not overwrite existing source rows. The import also converts existing published KZT price items to USD.

Before the first production deployment, back up the database and resolve the tariff approval issues in [the QA report](PRICE_CATALOG_QA_2026-09-18.md). The conversion uses the official NBK rate at import time. If the rate is unavailable, no new prices are published until an automatic retry succeeds. The site can temporarily show the old catalog while the import runs. Do not run multiple server replicas during the first import; this job uses a completion marker but no cross-instance lock.

The manual commands remain available for inspection or recovery from the `server` directory:

```sh
npm run import:prices:dry
npm run import:prices
```

The dry run suppresses the automatic bootstrap import and never writes catalog rows. In the local development database, the original manual import added all 1,882 rows and converted one legacy item, leaving 1,883 published entries.

## Ongoing editing

Admin, manager, and coordinator roles may add, edit, and delete catalog items. They can enter a KZT cost; the form shows a live USD preview and the source rate/date. On save, the **server** fetches the official NBK daily rate and recalculates the USD value. If the rate is unavailable or older than five days, saving a KZT amount fails rather than publishing an unverified conversion. The public catalog shows USD only.

The official rate is a daily accounting rate, not an intraday exchange quote. Patients submit selected services as a request, not a purchase. The server validates each selected service and stores a snapshot of its current USD amount; managers see the request and receive an in-app notification. The manager confirms the final services and treatment price.

The source workbook contains Russian service names only. Category labels are translated in the interface; service titles remain in the source language until reviewed translations are supplied.

The QA findings and source-tariff release gates are recorded in [the price catalog QA report](PRICE_CATALOG_QA_2026-09-18.md). Staff KZT saves include the previewed rate and date; if the official rate changes before saving, the server returns 409 and the form requests a fresh preview.
