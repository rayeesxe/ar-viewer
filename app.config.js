// Adds optional service keys at build time from GitHub secrets.
// Each online feature switches on when its key is present; the app works without them.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra || {}),
    youtubeKey: process.env.YOUTUBE_API_KEY || '',
    sketchfabToken: process.env.SKETCHFAB_TOKEN || '',
    polyPizzaKey: process.env.POLYPIZZA_KEY || '',
    meshyKey: process.env.MESHY_KEY || '',
  },
});
