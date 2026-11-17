import { useCallback } from "react";

export async function openAdsPrivacyOptions() {
  return false;
}

export function useGoogleMobileAds(_enabled: boolean) {
  return false;
}
export function useSwipeInterstitialAds(..._args: unknown[]) {
  const onSwipe = useCallback((): boolean => false, []);
  const showAtBreak = useCallback((_placement: string): boolean => false, []);
  return { onSwipe, showAtBreak };
}

export function SparkAdBanner(_props: { enabled: boolean; placement: string; tone?: "light" | "dark"; size?: "adaptive" | "card"; onLoaded?: () => void; onFailed?: () => void }) {
  return null;
}
