// Adds the optional YouTube Data API key (GitHub secret YOUTUBE_API_KEY) at build time.
// Without a key the app still finds videos through YouTube's public results page.
module.exports = ({ config }) => ({
  ...config,
  extra: { ...(config.extra || {}), youtubeKey: process.env.YOUTUBE_API_KEY || '' },
});
