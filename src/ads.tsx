import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Purchases from "react-native-purchases";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
  type PaidEvent
} from "react-native-google-mobile-ads";

const adUnitIds = {
  ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID || TestIds.BANNER,
  android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID || TestIds.BANNER
};

function getBannerUnitId() {
  return Platform.OS === "ios" ? adUnitIds.ios : adUnitIds.android;
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
