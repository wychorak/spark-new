import { useCallback } from "react";

export async function openAdsPrivacyOptions() {
  return false;
}

export function useGoogleMobileAds(_enabled: boolean) {
  return false;
}
export function useSwipeInterstitialAds(_enabled: boolean) {
  return useCallback(() => undefined, []);
}

export function SparkAdBanner(_props: { enabled: boolean; placement: string }) {
  return null;
}
