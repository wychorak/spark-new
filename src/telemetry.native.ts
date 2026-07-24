import { getAnalytics, logEvent, setUserId as setAnalyticsUserId, setUserProperties } from "@react-native-firebase/analytics";
import { getCrashlytics, log as logCrash, recordError, setAttributes, setUserId as setCrashUserId } from "@react-native-firebase/crashlytics";
import remoteConfig from "@react-native-firebase/remote-config";

export type SparkReleaseConfig = {
  swipesPerInterstitial: number;
  emptyFeedAutoExpand: boolean;
  maintenanceMode: boolean;
};

export const defaultSparkReleaseConfig: SparkReleaseConfig = {
  swipesPerInterstitial: 10,
  emptyFeedAutoExpand: true,
  maintenanceMode: false
};

type EventValue = string | number | boolean | null | undefined;

function sanitizeParams(params: Record<string, EventValue>) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .slice(0, 20)
      .map(([key, value]) => [key.slice(0, 40), typeof value === "string" ? value.slice(0, 100) : value])
  );
}

export async function initializeSparkTelemetry() {
  const config = remoteConfig();
  await config.setDefaults({
    swipes_per_interstitial: defaultSparkReleaseConfig.swipesPerInterstitial,
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
    swipesPerInterstitial: Math.max(5, Math.min(30, Math.round(config.getValue("swipes_per_interstitial").asNumber() || defaultSparkReleaseConfig.swipesPerInterstitial))),
    emptyFeedAutoExpand: config.getValue("empty_feed_auto_expand").asBoolean(),
    maintenanceMode: config.getValue("maintenance_mode").asBoolean()
  } satisfies SparkReleaseConfig;
}

export async function identifyTelemetryUser(uid: string | null, isPro: boolean) {
  const analytics = getAnalytics();
  const crashlytics = getCrashlytics();
  await Promise.all([
    setAnalyticsUserId(analytics, uid),
    setUserProperties(analytics, { plan: isPro ? "pro" : "free" }),
    setCrashUserId(crashlytics, uid ?? ""),
    setAttributes(crashlytics, { plan: isPro ? "pro" : "free" })
  ]);
}

export function trackSparkEvent(name: string, params: Record<string, EventValue> = {}) {
  const safeName = name.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
  void logEvent(getAnalytics(), safeName as never, sanitizeParams(params)).catch((error) => {
    if (__DEV__) console.warn("Spark analytics event failed", error);
  });
  logCrash(getCrashlytics(), safeName);
}

export function trackSparkScreen(screenName: string) {
  trackSparkEvent("screen_view", { screen_name: screenName, screen_class: screenName });
}

export function recordSparkError(error: unknown, context: string, attributes: Record<string, EventValue> = {}) {
  const normalized = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown Spark error");
  const crashlytics = getCrashlytics();
  logCrash(crashlytics, context.slice(0, 100));
  const safeAttributes = Object.fromEntries(
    Object.entries(sanitizeParams(attributes)).map(([key, value]) => [key, String(value)])
  );
  if (Object.keys(safeAttributes).length > 0) void setAttributes(crashlytics, safeAttributes);
  recordError(crashlytics, normalized, context.slice(0, 100));
  void logEvent(getAnalytics(), "exception", { description: context.slice(0, 100), fatal: false }).catch(() => undefined);
}