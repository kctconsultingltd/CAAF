export default {
  routes: [
    {
      method: 'POST',
      path: '/substack-subscribers/check',
      handler: 'substack-subscriber.check',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
