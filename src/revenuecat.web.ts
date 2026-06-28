import { useCallback, useMemo } from "react";

export const revenueCatEntitlementId =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "Sparknew Pro";

export const revenueCatProductIds = {
  weekly: process.env.EXPO_PUBLIC_REVENUECAT_WEEKLY_PRODUCT_ID || "sparkweek",
  monthly: process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID || "sparkmonth",
  lifetime: process.env.EXPO_PUBLIC_REVENUECAT_LIFETIME_PRODUCT_ID || "sparklifetime"
} as const;

export type SparkPlanId = keyof typeof revenueCatProductIds;

export type RevenueCatActionResult =
  | { ok: true; customerInfo?: null }
  | { ok: false; cancelled?: boolean; message: string };

export type RevenueCatState = {
  configured: boolean;
  isLoading: boolean;
  isPro: boolean;
  customerInfo: null;
  packages: [];
  error: string | null;
  refreshCustomerInfo: () => Promise<null>;
  purchasePlan: (planId: SparkPlanId) => Promise<RevenueCatActionResult>;
  restorePurchases: () => Promise<RevenueCatActionResult>;
  presentPaywallIfNeeded: () => Promise<boolean>;
  openCustomerCenter: () => Promise<RevenueCatActionResult>;
};

export function hasSparknewPro() {
  return false;
}

export function useRevenueCat(_appUserId: string | null): RevenueCatState {
  const refreshCustomerInfo = useCallback(async () => null, []);
  const unavailable = useCallback(
    async (): Promise<RevenueCatActionResult> => ({
      ok: false,
      message: "RevenueCat purchases are available in iOS and Android dev builds."
    }),
    []
  );
  const presentPaywallIfNeeded = useCallback(async () => false, []);

  return useMemo(
    () => ({
      configured: false,
      isLoading: false,
      isPro: false,
      customerInfo: null,
      packages: [],
      error: null,
      refreshCustomerInfo,
      purchasePlan: unavailable,
      restorePurchases: unavailable,
      presentPaywallIfNeeded,
      openCustomerCenter: unavailable
    }),
    [presentPaywallIfNeeded, refreshCustomerInfo, unavailable]
  );
}
