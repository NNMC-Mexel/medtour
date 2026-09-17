# International price catalog

The source is `ПРЕЙСКУРАНТ с 24.08.xlsx`, supplied by NNMC. Its two **paid** sheets contain 1,751 and 131 priced services. The two insurance sheets contain the same numbers of services at insurance tariffs and are excluded from the public international catalog. The public tariff uses column G, labelled for patients from countries outside the near abroad. This tariff choice should be reviewed if a separate CIS price is required.

The committed [catalog](../server/data/price-catalog-2026-08-24.json) contains 1,882 services. Each row keeps the workbook sheet/row identifier, original KZT amount, tariff code, USD amount, exchange rate, and rate date. Its USD snapshot used the [National Bank of Kazakhstan's official USD/KZT rate](https://nationalbank.kz/ru/page/RSS) of **444.88 KZT for 1 USD on 2026-09-17**, rounded to USD cents. The actual import recalculates USD using the official rate current on the import day and stores that rate/date on every row. The original workbook is not committed.

## Deployment

Back up the production database, deploy the server and frontend changes, then run once in the server environment:

```sh
npm run build
npm run import:prices:dry
npm run import:prices
```

The import adds missing source rows, converts legacy KZT price items to USD, and records completion in Strapi's store. Once completed, reruns preserve staff edits and deletions. The import does **not** run automatically at application boot. In the local development database it imported all 1,882 rows and converted one legacy item, leaving 1,883 published entries.

## Ongoing editing

Admin, manager, and coordinator roles may add, edit, and delete catalog items. They can enter a KZT cost; the form shows a live USD preview and the source rate/date. On save, the **server** fetches the official NBK daily rate and recalculates the USD value. If the rate is unavailable or older than five days, saving a KZT amount fails rather than publishing an unverified conversion. The public catalog shows USD only.

The official rate is a daily accounting rate, not an intraday exchange quote. Patients submit selected services as a request, not a purchase. The server validates each selected service and stores a snapshot of its current USD amount; managers see the request and receive an in-app notification. The manager confirms the final services and treatment price.

The source workbook contains Russian service names only. Category labels are translated in the interface; service titles remain in the source language until reviewed translations are supplied.
