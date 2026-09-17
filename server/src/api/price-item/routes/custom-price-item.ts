export default {
  routes: [
    { method: 'GET', path: '/price-items/catalog', handler: 'price-item.catalog', config: { auth: false } },
    { method: 'GET', path: '/price-items/public-exchange-rate', handler: 'price-item.exchangeRate', config: { auth: false } },
    { method: 'GET', path: '/price-items/staff-catalog', handler: 'price-item.catalog', config: { policies: ['global::is-price-editor'] } },
    { method: 'GET', path: '/price-items/exchange-rate', handler: 'price-item.exchangeRate', config: { policies: ['global::is-price-editor'] } },
  ],
};
