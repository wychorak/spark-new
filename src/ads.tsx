import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { Text } from "./i18n/Text";
import Purchases from "react-native-purchases";
import { trackSparkEvent } from "./telemetry";
import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  MaxAdContentRating,
  TestIds,
  type PaidEvent
} from "react-native-google-mobile-ads";


let mobileAdsStartPromise: Promise<boolean> | null = null;
let adImpressionSequence = 0;

function createAdImpressionId(placement: string, format: string) {
  adImpressionSequence += 1;
  return [placement, format, Date.now(), adImpressionSequence].join("-");
}

function getRevenueCatAdPrecision(precision: number) {
  if (precision === 3) return "exact";
  if (precision === 2) return "publisher_defined";
  if (precision === 1) return "estimated";
  return "unknown";
}

function toRevenueMicros(value: number) {
  return Math.max(0, Math.round(value * 1_000_000));
}

export async function openAdsPrivacyOptions() {
  if (Platform.OS === "web") {
    return false;
  }

  const testDeviceIdentifiers = getAdMobTestDeviceIdentifiers();
  const consentInfo = await AdsConsent.requestInfoUpdate({
    debugGeography: getAdMobDebugGeography(),
    testDeviceIdentifiers: testDeviceIdentifiers.length > 0 ? testDeviceIdentifiers : undefined
  });

  if (consentInfo.privacyOptionsRequirementStatus !== AdsConsentPrivacyOptionsRequirementStatus.REQUIRED) {
    return false;
  }

  await AdsConsent.showPrivacyOptionsForm();
  mobileAdsStartPromise = null;
  return true;
}

function getAdMobTestDeviceIdentifiers() {
  const configuredDevices = (process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_ID || "")
    .split(",")
    .map((deviceId: string) => deviceId.trim())
    .filter(Boolean);

  return __DEV__ ? ["EMULATOR", ...configuredDevices] : configuredDevices;
}

function getAdMobDebugGeography() {
  switch ((process.env.EXPO_PUBLIC_ADMOB_DEBUG_GEOGRAPHY || "").toUpperCase()) {
    case "EEA":
      return AdsConsentDebugGeography.EEA;
    case "REGULATED_US_STATE":
      return AdsConsentDebugGeography.REGULATED_US_STATE;
    case "OTHER":
    case "NOT_EEA":
      return AdsConsentDebugGeography.OTHER;
    case "DISABLED":
      return AdsConsentDebugGeography.DISABLED;
    default:
      return undefined;
  }
}

async function startGoogleMobileAds() {
  const testDeviceIdentifiers = getAdMobTestDeviceIdentifiers();
  const debugGeography = getAdMobDebugGeography();

  try {
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.MA,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      testDeviceIdentifiers: testDeviceIdentifiers.length > 0 ? testDeviceIdentifiers : undefined
    });

    await AdsConsent.gatherConsent({
      debugGeography,
      testDeviceIdentifiers: testDeviceIdentifiers.length > 0 ? testDeviceIdentifiers : undefined
    });

    const consentInfo = await AdsConsent.getConsentInfo();

    if (!consentInfo.canRequestAds) {
      return false;
    }

    await mobileAds().initialize();
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("Google Mobile Ads initialization failed", error);
    }

    try {
      const consentInfo = await AdsConsent.getConsentInfo();

      if (consentInfo.canRequestAds) {
        await mobileAds().initialize();
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }
}

export function useGoogleMobileAds(enabled: boolean) {
  const [canRequestAds, setCanRequestAds] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!enabled || Platform.OS === "web") {
      setCanRequestAds(false);
      return undefined;
    }

    mobileAdsStartPromise = mobileAdsStartPromise || startGoogleMobileAds();

    mobileAdsStartPromise.then((isReady) => {
      if (isMounted) {
        setCanRequestAds(isReady);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  return canRequestAds;
}
const productionAdUnitIds = {
  ios: "ca-app-pub-8263324816746737/9299047738",
  android: "ca-app-pub-8263324816746737/1021936619",
  iosChat: "ca-app-pub-8263324816746737/4185554914",
  iosInterstitial: "ca-app-pub-8263324816746737/4491619788",
  androidInterstitial: "ca-app-pub-8263324816746737/8708854948"
};

const adUnitIds = {
  ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID || (__DEV__ ? TestIds.BANNER : productionAdUnitIds.ios),
  android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID || (__DEV__ ? TestIds.BANNER : productionAdUnitIds.android),
  iosChat: process.env.EXPO_PUBLIC_ADMOB_IOS_CHAT_BANNER_ID || (__DEV__ ? TestIds.BANNER : productionAdUnitIds.iosChat),
  androidChat: process.env.EXPO_PUBLIC_ADMOB_ANDROID_CHAT_BANNER_ID || process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID || (__DEV__ ? TestIds.BANNER : productionAdUnitIds.android),
  iosInterstitial: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID || (__DEV__ ? TestIds.INTERSTITIAL : productionAdUnitIds.iosInterstitial),
  androidInterstitial: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID || (__DEV__ ? TestIds.INTERSTITIAL : productionAdUnitIds.androidInterstitial)
};

function getBannerUnitId(placement: string) {
  if (placement === "messages-list") {
    return Platform.OS === "ios" ? adUnitIds.iosChat : adUnitIds.androidChat;
  }

  return Platform.OS === "ios" ? adUnitIds.ios : adUnitIds.android;
}

function getInterstitialUnitId() {
  return Platform.OS === "ios" ? adUnitIds.iosInterstitial : adUnitIds.androidInterstitial;
}

export const SWIPES_PER_INTERSTITIAL = 30;
// No full-screen ad right after opening the app (default 60 s, Remote Config).
const INTERSTITIAL_SESSION_GRACE_MS = 60 * 1000;
// Coming back after this long in the background starts a new ad session.
const INTERSTITIAL_SESSION_RESET_MS = 30 * 60 * 1000;
const INTERSTITIAL_RETRY_DELAYS_MS = [10_000, 30_000];

export function useSwipeInterstitialAds(
  enabled: boolean,
  swipeThreshold = SWIPES_PER_INTERSTITIAL,
  minIntervalSeconds = 90,
  maxPerSession = 8,
  sessionGraceMs = INTERSTITIAL_SESSION_GRACE_MS
) {
  const swipeCount = useRef(0);
  const enabledRef = useRef(enabled);
  const isLoading = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const lastShownAt = useRef(0);
  const sessionStartedAt = useRef(Date.now());
  const sessionImpressionCount = useRef(0);
  const impressionId = useRef("");
  const placement = useRef("swipe-feed");
  if (!impressionId.current) impressionId.current = createAdImpressionId("swipe-feed", "interstitial");
  const [isLoaded, setIsLoaded] = useState(false);
  const isLoadedRef = useRef(false);
  isLoadedRef.current = isLoaded;
  const adUnitId = getInterstitialUnitId();
  enabledRef.current = enabled;

  useEffect(() => {
    let backgroundedAt = 0;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") backgroundedAt = Date.now();
      else if (state === "active" && backgroundedAt && Date.now() - backgroundedAt > INTERSTITIAL_SESSION_RESET_MS) {
        sessionStartedAt.current = Date.now();
        sessionImpressionCount.current = 0;
        swipeCount.current = 0;
      }
    });
    return () => subscription.remove();
  }, []);
  const interstitial = useRef(
    Platform.OS === "web"
      ? null
      : InterstitialAd.createForAdRequest(adUnitId, {
          requestNonPersonalizedAdsOnly: true
        })
  );

  useEffect(() => {
    if (!enabled || Platform.OS === "web" || !interstitial.current) {
      return undefined;
    }

    const loadedUnsubscribe = interstitial.current.addAdEventListener(AdEventType.LOADED, () => {
      isLoading.current = false;
      retryCount.current = 0;
      isLoadedRef.current = true;
      setIsLoaded(true);
      Purchases.adTracker.trackAdLoaded({
        mediatorName: "AdMob",
        adFormat: "interstitial",
        adUnitId,
        impressionId: impressionId.current,
        placement: placement.current
      }).catch(() => undefined);
    });

    const openedUnsubscribe = interstitial.current.addAdEventListener(AdEventType.OPENED, () => {
      trackSparkEvent("ad_impression", { format: "interstitial", placement: placement.current });
      Purchases.adTracker.trackAdDisplayed({
        mediatorName: "AdMob",
        adFormat: "interstitial",
        adUnitId,
        impressionId: impressionId.current,
        placement: placement.current
      }).catch(() => undefined);
    });

    const paidUnsubscribe = interstitial.current.addAdEventListener(AdEventType.PAID, (payload) => {
      const paidEvent = payload as unknown as PaidEvent;

      if (!paidEvent?.currency || typeof paidEvent.value !== "number") {
        return;
      }

      Purchases.adTracker.trackAdRevenue({
        mediatorName: "AdMob",
        adFormat: "interstitial",
        adUnitId,
        impressionId: impressionId.current,
        revenueMicros: toRevenueMicros(paidEvent.value),
        currency: paidEvent.currency,
        precision: getRevenueCatAdPrecision(Number(paidEvent.precision)),
        placement: placement.current
      }).catch(() => undefined);
    });

    const closedUnsubscribe = interstitial.current.addAdEventListener(AdEventType.CLOSED, () => {
      setIsLoaded(false);
      swipeCount.current = 0;
      impressionId.current = createAdImpressionId("swipe-feed", "interstitial");
      isLoading.current = true;
      interstitial.current?.load();
    });

    const errorUnsubscribe = interstitial.current.addAdEventListener(AdEventType.ERROR, () => {
      setIsLoaded(false);
      isLoading.current = false;
      trackSparkEvent("ad_load_failed", { format: "interstitial", placement: placement.current });
      Purchases.adTracker.trackAdFailedToLoad({
        mediatorName: "AdMob",
        adFormat: "interstitial",
        adUnitId,
        placement: placement.current
      }).catch(() => undefined);
      impressionId.current = createAdImpressionId("swipe-feed", "interstitial");

      if (!retryTimer.current && retryCount.current < INTERSTITIAL_RETRY_DELAYS_MS.length) {
        const delay = INTERSTITIAL_RETRY_DELAYS_MS[retryCount.current];
        retryCount.current += 1;
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          if (!enabledRef.current || !interstitial.current || isLoading.current) return;
          isLoading.current = true;
          interstitial.current.load();
        }, delay);
      }
    });

    isLoading.current = true;
    interstitial.current.load();

    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
      loadedUnsubscribe();
      openedUnsubscribe();
      paidUnsubscribe();
      closedUnsubscribe();
      errorUnsubscribe();
    };
  }, [adUnitId, enabled]);

  const capReached = () =>
    sessionImpressionCount.current >= Math.max(1, Math.min(10, maxPerSession)) ||
    Date.now() - lastShownAt.current < Math.max(90, Math.min(1800, minIntervalSeconds)) * 1000;

  // Shows the preloaded ad; counters move at show time so a tab change cannot lose them.
  const show = (where: string) => {
    if (!interstitial.current) return false;
    if (!isLoadedRef.current) {
      if (!isLoading.current) {
        isLoading.current = true;
        interstitial.current.load();
      }
      return false;
    }
    placement.current = where;
    isLoadedRef.current = false;
    setIsLoaded(false);
    swipeCount.current = 0;
    lastShownAt.current = Date.now();
    sessionImpressionCount.current += 1;
    void interstitial.current.show().catch(() => {
      trackSparkEvent("ad_show_failed", { format: "interstitial", placement: where });
      // Not shown: give the slot back and fetch a fresh ad.
      lastShownAt.current = 0;
      sessionImpressionCount.current = Math.max(0, sessionImpressionCount.current - 1);
      isLoading.current = true;
      interstitial.current?.load();
    });
    return true;
  };

  /** Count a feed swipe; returns true when a full-screen ad is shown for it. */
  const onSwipe = useCallback((): boolean => {
    if (!enabled || Platform.OS === "web") return false;
    swipeCount.current += 1;
    if (swipeCount.current < Math.max(5, Math.min(60, swipeThreshold))) return false;
    if (capReached() || Date.now() - sessionStartedAt.current < Math.max(0, Math.min(600_000, sessionGraceMs))) return false;
    return show("swipe-feed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isLoaded, maxPerSession, minIntervalSeconds, sessionGraceMs, swipeThreshold]);

  /** Natural break (e.g. "It's a match" -> chat): same caps, no swipe count needed. */
  const showAtBreak = useCallback((where: string): boolean => {
    if (!enabled || Platform.OS === "web" || capReached()) return false;
    return show(where);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isLoaded, maxPerSession, minIntervalSeconds]);

  return { onSwipe, showAtBreak };
}

export function SparkAdBanner({ enabled, placement, tone = "light", size = "adaptive", onLoaded, onFailed }: {
  enabled: boolean;
  placement: string;
  tone?: "light" | "dark";
  /** "card" = 300x250 inside the sponsored deck card (no frame, no retry). */
  size?: "adaptive" | "card";
  onLoaded?: () => void;
  onFailed?: () => void;
}) {
  const impressionId = useRef("");
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "failed">("loading");
  const [retryKey, setRetryKey] = useState(0);
  if (!impressionId.current) impressionId.current = createAdImpressionId(placement, "banner");

  const adUnitId = getBannerUnitId(placement);

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  if (!enabled || Platform.OS === "web") {
    return null;
  }

  const scheduleRetry = () => {
    if (retryTimer.current || retryCount.current >= 2) return;
    const delay = retryCount.current === 0 ? 10_000 : 30_000;
    retryCount.current += 1;
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      setLoadState("loading");
      setRetryKey((value) => value + 1);
    }, delay);
  };

  return (
    <View pointerEvents={loadState === "loaded" ? "auto" : "none"} style={[size === "card" ? styles.cardWrapper : styles.wrapper, size !== "card" && tone === "dark" && styles.wrapperDark, loadState !== "loaded" && styles.wrapperPending]}>
      {loadState === "loaded" && size !== "card" && <Text style={[styles.label, tone === "dark" && styles.labelDark]}>Reklama</Text>}
      <BannerAd
        key={adUnitId + "-" + retryKey}
        unitId={adUnitId}
        size={size === "card" ? BannerAdSize.MEDIUM_RECTANGLE : BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={(error) => {
          setLoadState("failed");
          trackSparkEvent("ad_load_failed", { format: "banner", placement });
          if (onFailed) onFailed();
          else scheduleRetry();
          if (__DEV__) {
            console.warn("AdMob banner failed", error);
          }
          Purchases.adTracker.trackAdFailedToLoad({
            mediatorName: "AdMob",
            adFormat: "banner",
            adUnitId,
            placement
          }).catch(() => undefined);
        }}
        onAdLoaded={() => {
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = null;
          retryCount.current = 0;
          setLoadState("loaded");
          onLoaded?.();
          impressionId.current = createAdImpressionId(placement, "banner");
          Purchases.adTracker.trackAdLoaded({
            mediatorName: "AdMob",
            adFormat: "banner",
            adUnitId,
            impressionId: impressionId.current,
            placement
          }).catch(() => undefined);
        }}
        onAdImpression={() => {
          trackSparkEvent("ad_impression", { format: "banner", placement });
          Purchases.adTracker.trackAdDisplayed({
            mediatorName: "AdMob",
            adFormat: "banner",
            adUnitId,
            impressionId: impressionId.current,
            placement
          }).catch(() => undefined);
        }}
        onPaid={(event: PaidEvent) => {
          Purchases.adTracker.trackAdRevenue({
            mediatorName: "AdMob",
            adFormat: "banner",
            adUnitId,
            impressionId: impressionId.current,
            revenueMicros: toRevenueMicros(event.value),
            currency: event.currency,
            precision: getRevenueCatAdPrecision(Number(event.precision)),
            placement
          }).catch(() => undefined);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 86,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(145,110,111,0.16)",
    overflow: "hidden"
  },
  cardWrapper: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    overflow: "hidden"
  },
  wrapperDark: {
    backgroundColor: "rgba(20,20,26,0.9)",
    borderColor: "rgba(255,45,141,0.16)"
  },
  wrapperPending: {
    minHeight: 1,
    height: 1,
    opacity: 0,
    borderWidth: 0,
    backgroundColor: "transparent"
  },
  label: {
    color: "#86868b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  labelDark: {
    color: "#8f8791"
  }
});
