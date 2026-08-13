export default {
  routes: [
    {
      method: 'POST',
      path: '/pitch-submissions',
      handler: 'pitch-submission.create',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/pitch-submissions/export',
      handler: 'pitch-submission.exportData',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
