export default {
  routes: [
    {
      method: 'POST',
      path: '/resources/:documentId/download',
      handler: 'resource.download',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
