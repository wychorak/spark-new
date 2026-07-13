const appJson = require("./app.json");
const { withInfoPlist } = require("expo/config-plugins");

function withReleaseInfoPlist(config) {
  return withInfoPlist(config, (nextConfig) => {
    const plist = nextConfig.modResults;
    delete plist.NSBonjourServices;
    delete plist.NSLocalNetworkUsageDescription;
    delete plist.NSLocationAlwaysUsageDescription;
    delete plist.NSLocationAlwaysAndWhenInUseUsageDescription;
    delete plist.NSMotionUsageDescription;

    if (plist.NSAppTransportSecurity) {
      delete plist.NSAppTransportSecurity.NSAllowsArbitraryLoads;
      if (plist.NSAppTransportSecurity.NSExceptionDomains) {
        delete plist.NSAppTransportSecurity.NSExceptionDomains.localhost;
        if (Object.keys(plist.NSAppTransportSecurity.NSExceptionDomains).length === 0) {
          delete plist.NSAppTransportSecurity.NSExceptionDomains;
        }
      }
      if (Object.keys(plist.NSAppTransportSecurity).length === 0) {
        delete plist.NSAppTransportSecurity;
      }
    }

    return nextConfig;
  });
}

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

module.exports = ({ config }) => withReleaseInfoPlist({
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