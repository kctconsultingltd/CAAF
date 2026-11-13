export default {
  routes: [
    {
      method: 'POST',
      path: '/substack-subscribers/check',
      handler: 'substack-subscriber.check',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/substack-subscribers/subscribe',
      handler: 'substack-subscriber.subscribe',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
