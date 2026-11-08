export default {
  routes: [
    {
      method: 'GET',
      path: '/resource-downloads/export',
      handler: 'resource-download.exportCsv',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
