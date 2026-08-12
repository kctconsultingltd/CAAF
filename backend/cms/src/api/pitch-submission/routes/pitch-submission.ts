export default {
  routes: [
    {
      method: 'POST',
      path: '/pitch-submissions',
      handler: 'pitch-submission.create',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
