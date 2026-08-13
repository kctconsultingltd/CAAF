export default {
  routes: [
    {
      method: 'POST',
      path: '/newsletter-subscribers',
      handler: 'newsletter-subscriber.create',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/newsletter-subscribers/export',
      handler: 'newsletter-subscriber.exportCsv',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
