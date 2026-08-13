export default {
  routes: [
    {
      method: 'POST',
      path: '/newsletter-subscribers',
      handler: 'newsletter-subscriber.create',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
