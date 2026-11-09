// Expo passes the resolved app.json `expo` values in as `config`.
module.exports = ({ config }) => {
  const android = config.android || {};

  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_TILE_API_KEY ||
    '';

  return {
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
};
