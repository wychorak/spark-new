import remoteConfig from "@react-native-firebase/remote-config";

export type SparkReleaseConfig = {
  swipesPerInterstitial: number;
  interstitialMinIntervalSeconds: number;
  maxInterstitialsPerSession: number;
  emptyFeedAutoExpand: boolean;
  maintenanceMode: boolean;
};

export const defaultSparkReleaseConfig: SparkReleaseConfig = {
  swipesPerInterstitial: 10,
  interstitialMinIntervalSeconds: 120,
  maxInterstitialsPerSession: 4,
  emptyFeedAutoExpand: true,
  maintenanceMode: false
};

type EventValue = string | number | boolean | null | undefined;

export async function initializeSparkTelemetry() {
  const config = remoteConfig();
  await config.setDefaults({
    swipes_per_interstitial: defaultSparkReleaseConfig.swipesPerInterstitial,
    interstitial_min_interval_seconds: defaultSparkReleaseConfig.interstitialMinIntervalSeconds,
    max_interstitials_per_session: defaultSparkReleaseConfig.maxInterstitialsPerSession,
    empty_feed_auto_expand: defaultSparkReleaseConfig.emptyFeedAutoExpand,
    maintenance_mode: defaultSparkReleaseConfig.maintenanceMode
  });
  await config.setConfigSettings({ minimumFetchIntervalMillis: __DEV__ ? 0 : 60 * 60 * 1000 });
  try {
    await config.fetchAndActivate();
  } catch (error) {
    recordSparkError(error, "remote_config_fetch");
  }

  return {
    swipesPerInterstitial: Math.max(10, Math.min(30, Math.round(config.getValue("swipes_per_interstitial").asNumber() || defaultSparkReleaseConfig.swipesPerInterstitial))),
    interstitialMinIntervalSeconds: Math.max(90, Math.min(600, Math.round(config.getValue("interstitial_min_interval_seconds").asNumber() || defaultSparkReleaseConfig.interstitialMinIntervalSeconds))),
    maxInterstitialsPerSession: Math.max(1, Math.min(6, Math.round(config.getValue("max_interstitials_per_session").asNumber() || defaultSparkReleaseConfig.maxInterstitialsPerSession))),
    emptyFeedAutoExpand: config.getValue("empty_feed_auto_expand").asBoolean(),
    maintenanceMode: config.getValue("maintenance_mode").asBoolean()
  } satisfies SparkReleaseConfig;
}

export async function identifyTelemetryUser(_uid: string | null, _isPro: boolean) {
  // Analytics and crash collection are disabled until an explicit in-app
  // consent and opt-out flow is implemented.
}

export function trackSparkEvent(_name: string, _params: Record<string, EventValue> = {}) {
  // Intentionally disabled; do not add personal data to console logs.
}

export function trackSparkScreen(screenName: string) {
  trackSparkEvent("screen_view", { screen_name: screenName, screen_class: screenName });
}

export function recordSparkError(error: unknown, context: string, _attributes: Record<string, EventValue> = {}) {
  if (__DEV__) {
    console.warn(`[Spark:${context.slice(0, 100)}]`, error instanceof Error ? error.message : "Unknown error");
  }
}
