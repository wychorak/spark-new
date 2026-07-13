import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Purchases from "react-native-purchases";
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
  iosInterstitial: "ca-app-pub-8263324816746737/4491619788",
  androidInterstitial: "ca-app-pub-8263324816746737/8708854948"
};

const adUnitIds = {
  ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID || (__DEV__ ? TestIds.BANNER : productionAdUnitIds.ios),
  android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID || (__DEV__ ? TestIds.BANNER : productionAdUnitIds.android),
  iosInterstitial: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID || (__DEV__ ? TestIds.INTERSTITIAL : productionAdUnitIds.iosInterstitial),
  androidInterstitial: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID || (__DEV__ ? TestIds.INTERSTITIAL : productionAdUnitIds.androidInterstitial)
};

function getBannerUnitId() {
  return Platform.OS === "ios" ? adUnitIds.ios : adUnitIds.android;
}

function getInterstitialUnitId() {
  return Platform.OS === "ios" ? adUnitIds.iosInterstitial : adUnitIds.androidInterstitial;
}

function nextSwipeAdThreshold() {
  return 5 + Math.floor(Math.random() * 6);
}

export function useSwipeInterstitialAds(enabled: boolean) {
  const swipeCount = useRef(0);
  const nextAdAt = useRef(nextSwipeAdThreshold());
  const [isLoaded, setIsLoaded] = useState(false);
  const adUnitId = getInterstitialUnitId();
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
      setIsLoaded(true);
      Purchases.adTracker.trackAdLoaded({
        mediatorName: "AdMob",
        adFormat: "interstitial",
        adUnitId,
        impressionId: "swipe-interstitial",
        placement: "swipe-feed"
      }).catch(() => undefined);
    });

    const openedUnsubscribe = interstitial.current.addAdEventListener(AdEventType.OPENED, () => {
      Purchases.adTracker.trackAdDisplayed({
        mediatorName: "AdMob",
        adFormat: "interstitial",
        adUnitId,
        impressionId: "swipe-interstitial",
        placement: "swipe-feed"
      }).catch(() => undefined);
    });

    const closedUnsubscribe = interstitial.current.addAdEventListener(AdEventType.CLOSED, () => {
      setIsLoaded(false);
      swipeCount.current = 0;
      nextAdAt.current = nextSwipeAdThreshold();
      interstitial.current?.load();
    });

    const errorUnsubscribe = interstitial.current.addAdEventListener(AdEventType.ERROR, () => {
      setIsLoaded(false);
      swipeCount.current = 0;
      nextAdAt.current = nextSwipeAdThreshold();
    });

    interstitial.current.load();

    return () => {
      loadedUnsubscribe();
      openedUnsubscribe();
      closedUnsubscribe();
      errorUnsubscribe();
    };
  }, [adUnitId, enabled]);

  return useCallback(() => {
    if (!enabled || Platform.OS === "web" || !interstitial.current) {
      return;
    }

    swipeCount.current += 1;

    if (swipeCount.current < nextAdAt.current) {
      return;
    }

    if (isLoaded) {
      interstitial.current.show();
      return;
    }

    interstitial.current.load();
  }, [enabled, isLoaded]);
}

export function SparkAdBanner({ enabled, placement }: { enabled: boolean; placement: string }) {
  if (!enabled || Platform.OS === "web") {
    return null;
  }

  const adUnitId = getBannerUnitId();

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Reklama</Text>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={(error) => {
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
          Purchases.adTracker.trackAdLoaded({
            mediatorName: "AdMob",
            adFormat: "banner",
            adUnitId,
            impressionId: `${placement}-banner`,
            placement
          }).catch(() => undefined);
        }}
        onAdImpression={() => {
          Purchases.adTracker.trackAdDisplayed({
            mediatorName: "AdMob",
            adFormat: "banner",
            adUnitId,
            impressionId: `${placement}-banner`,
            placement
          }).catch(() => undefined);
        }}
        onPaid={(event: PaidEvent) => {
          Purchases.adTracker.trackAdRevenue({
            mediatorName: "AdMob",
            adFormat: "banner",
            adUnitId,
            impressionId: `${placement}-banner`,
            revenueMicros: event.value,
            currency: event.currency,
            precision: String(event.precision),
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
  label: {
    color: "#86868b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  }
});
