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

export async function initializeSparkTelemetry() {
  return defaultSparkReleaseConfig;
}

export async function identifyTelemetryUser(_uid: string | null, _isPro: boolean) {}
export function trackSparkEvent(_name: string, _params: Record<string, unknown> = {}) {}
export function trackSparkScreen(_screenName: string) {}
export function recordSparkError(error: unknown, context: string, _attributes: Record<string, unknown> = {}) {
  if (__DEV__) console.error(context, error);
}