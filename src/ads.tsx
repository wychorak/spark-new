import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
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

export const SWIPES_PER_INTERSTITIAL = 10;
const INTERSTITIAL_RETRY_DELAYS_MS = [10_000, 30_000];

export function useSwipeInterstitialAds(
  enabled: boolean,
  swipeThreshold = SWIPES_PER_INTERSTITIAL,
  minIntervalSeconds = 120,
  maxPerSession = 4
) {
  const swipeCount = useRef(0);
  const enabledRef = useRef(enabled);
  const isLoading = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const lastShownAt = useRef(0);
  const sessionImpressionCount = useRef(0);
  const impressionId = useRef("");
  if (!impressionId.current) impressionId.current = createAdImpressionId("swipe-feed", "interstitial");
  const [isLoaded, setIsLoaded] = useState(false);
  const adUnitId = getInterstitialUnitId();
  enabledRef.current = enabled;
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
      setIsLoaded(true);
      Purchases.adTracker.trackAdLoaded({
        mediatorName: "AdMob",
        adFormat: "interstitial",
        adUnitId,
        impressionId: impressionId.current,
        placement: "swipe-feed"
      }).catch(() => undefined);
    });

    const openedUnsubscribe = interstitial.current.addAdEventListener(AdEventType.OPENED, () => {
      swipeCount.current = 0;
      lastShownAt.current = Date.now();
      sessionImpressionCount.current += 1;
      trackSparkEvent("ad_impression", { format: "interstitial", placement: "swipe-feed" });
      Purchases.adTracker.trackAdDisplayed({
        mediatorName: "AdMob",
        adFormat: "interstitial",
        adUnitId,
        impressionId: impressionId.current,
        placement: "swipe-feed"
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
        placement: "swipe-feed"
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
      trackSparkEvent("ad_load_failed", { format: "interstitial", placement: "swipe-feed" });
      Purchases.adTracker.trackAdFailedToLoad({
        mediatorName: "AdMob",
        adFormat: "interstitial",
        adUnitId,
        placement: "swipe-feed"
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

  return useCallback(() => {
    if (!enabled || Platform.OS === "web" || !interstitial.current) {
      return;
    }

    swipeCount.current += 1;

    if (swipeCount.current < Math.max(5, Math.min(30, swipeThreshold))) {
      return;
    }

    if (
      sessionImpressionCount.current >= Math.max(1, Math.min(6, maxPerSession)) ||
      Date.now() - lastShownAt.current < Math.max(90, Math.min(600, minIntervalSeconds)) * 1000
    ) {
      return;
    }

    if (isLoaded) {
      setIsLoaded(false);
      void interstitial.current.show().catch(() => {
        isLoading.current = false;
        trackSparkEvent("ad_show_failed", { format: "interstitial", placement: "swipe-feed" });
      });
      return;
    }

    if (!isLoading.current) {
      isLoading.current = true;
      interstitial.current.load();
    }
  }, [enabled, isLoaded, maxPerSession, minIntervalSeconds, swipeThreshold]);
}

export function SparkAdBanner({ enabled, placement, tone = "light" }: { enabled: boolean; placement: string; tone?: "light" | "dark" }) {
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
    <View pointerEvents={loadState === "loaded" ? "auto" : "none"} style={[styles.wrapper, tone === "dark" && styles.wrapperDark, loadState !== "loaded" && styles.wrapperPending]}>
      {loadState === "loaded" && <Text style={[styles.label, tone === "dark" && styles.labelDark]}>Reklama</Text>}
      <BannerAd
        key={adUnitId + "-" + retryKey}
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={(error) => {
          setLoadState("failed");
          trackSparkEvent("ad_load_failed", { format: "banner", placement });
          scheduleRetry();
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
