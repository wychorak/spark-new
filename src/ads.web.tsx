import { useCallback } from "react";

export function useSwipeInterstitialAds(_enabled: boolean) {
  return useCallback(() => undefined, []);
}

export function SparkAdBanner(_props: { enabled: boolean; placement: string }) {
  return null;
}
