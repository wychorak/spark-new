const appJson = require("./app.json");
const { withInfoPlist, withPodfile } = require("expo/config-plugins");

function addModularHeadersToPodfile(podfile) {
  const marker = "prepare_react_native_project!";

  if (podfile.includes("use_modular_headers!")) {
    return podfile;
  }

  if (!podfile.includes(marker)) {
    throw new Error("Unable to configure CocoaPods modular headers: Podfile marker is missing.");
  }

  return podfile.replace(marker, `use_modular_headers!\n\n${marker}`);
}

function withIosModularHeaders(config) {
  return withPodfile(config, (nextConfig) => {
    nextConfig.modResults.contents = addModularHeadersToPodfile(nextConfig.modResults.contents);
    return nextConfig;
  });
}

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

module.exports = ({ config }) => withIosModularHeaders(withReleaseInfoPlist({
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
}));

module.exports.addModularHeadersToPodfile = addModularHeadersToPodfile;
