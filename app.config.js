const appJson = require("./app.json");

function withAdMobEnv(plugins = []) {
  return plugins.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "react-native-google-mobile-ads") {
      return plugin;
    }

    const options = plugin[1] || {};

    return [
      plugin[0],
      {
        ...options,
        androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || options.androidAppId,
        iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || options.iosAppId
      }
    ];
  });
}

module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  ios: {
    ...(config.ios || {}),
    ...(appJson.expo.ios || {})
  },
  android: {
    ...(config.android || {}),
    ...(appJson.expo.android || {})
  },
  plugins: withAdMobEnv(appJson.expo.plugins || [])
});