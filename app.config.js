const appJson = require('./app.json');

const config = appJson.expo || {};
const android = config.android || {};

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_TILE_API_KEY ||
  '';

module.exports = {
  ...config,
  android: {
    ...android,
    config: {
      ...(android.config || {}),
      googleMaps: {
        ...((android.config && android.config.googleMaps) || {}),
        apiKey: googleMapsApiKey,
      },
    },
  },
};
