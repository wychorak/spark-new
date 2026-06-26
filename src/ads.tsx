import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Purchases from "react-native-purchases";
import {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  TestIds,
  type PaidEvent
} from "react-native-google-mobile-ads";

const adUnitIds = {
  ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID || TestIds.BANNER,
  android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID || TestIds.BANNER,
  iosInterstitial: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID || TestIds.INTERSTITIAL,
  androidInterstitial: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID || TestIds.INTERSTITIAL
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
          console.warn("AdMob banner failed", error);
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
