/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  serverBuildTarget: 'cloudflare-pages',
  serverDependenciesToBundle: 'all',
  future: {
    v3_singleFetch: true,
  },
};
