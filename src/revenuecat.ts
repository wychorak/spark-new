import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

export const revenueCatEntitlementId =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "Sparknew Pro";

export const revenueCatProductIds = {
  weekly: process.env.EXPO_PUBLIC_REVENUECAT_WEEKLY_PRODUCT_ID || "Sparkproweek",
  monthly: process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID || "Sparkpromonth",
  lifetime: process.env.EXPO_PUBLIC_REVENUECAT_LIFETIME_PRODUCT_ID || "sparkprolifetime"
} as const;

export type SparkPlanId = keyof typeof revenueCatProductIds;

export type RevenueCatActionResult =
  | { ok: true; customerInfo?: CustomerInfo | null }
  | { ok: false; cancelled?: boolean; message: string };

export type RevenueCatState = {
  configured: boolean;
  isLoading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  packages: PurchasesPackage[];
  error: string | null;
  refreshCustomerInfo: () => Promise<CustomerInfo | null>;
  purchasePlan: (planId: SparkPlanId) => Promise<RevenueCatActionResult>;
  restorePurchases: () => Promise<RevenueCatActionResult>;
  presentPaywallIfNeeded: () => Promise<boolean>;
  openCustomerCenter: () => Promise<RevenueCatActionResult>;
};

let didConfigureRevenueCat = false;

function getRevenueCatApiKey() {
  return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || "test_ZXrasnBoneOhTMZGyJXoPEEacNC";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return "RevenueCat request failed.";
}

export function hasSparknewPro(customerInfo: CustomerInfo | null) {
  return Boolean(customerInfo?.entitlements.active[revenueCatEntitlementId]);
}

function isUserCancelled(error: unknown) {
  return Boolean(
    typeof error === "object" &&
      error !== null &&
      "userCancelled" in error &&
      (error as { userCancelled?: boolean }).userCancelled
  );
}

function matchPackageForPlan(packages: PurchasesPackage[], planId: SparkPlanId) {
  const productId = revenueCatProductIds[planId];

  return packages.find((item) => {
    const candidateValues = [
      item.identifier,
      item.packageType,
      item.product.identifier
    ].map((value) => String(value).toLowerCase());

    return candidateValues.some((value) => value.includes(productId));
  });
}

export function useRevenueCat(appUserId: string | null): RevenueCatState {
  const [configured, setConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const previousUserId = useRef<string | null>(null);

  const refreshCustomerInfo = useCallback(async () => {
    if (Platform.OS === "web") {
      return null;
    }

    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      setError(null);
      return info;
    } catch (refreshError) {
      setError(getErrorMessage(refreshError));
      return null;
    }
  }, []);

  const refreshOfferings = useCallback(async () => {
    if (Platform.OS === "web") {
      return;
    }

    try {
      const offerings = await Purchases.getOfferings();
      setPackages(offerings.current?.availablePackages ?? []);
      setError(null);
    } catch (offeringsError) {
      setError(getErrorMessage(offeringsError));
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsLoading(false);
      return undefined;
    }

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);

    if (!didConfigureRevenueCat) {
      Purchases.configure({ apiKey: getRevenueCatApiKey() });
      didConfigureRevenueCat = true;
    }

    setConfigured(true);
    setIsLoading(true);

    const listener = (info: CustomerInfo) => {
      setCustomerInfo(info);
      setError(null);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    Promise.all([refreshCustomerInfo(), refreshOfferings()]).finally(() => setIsLoading(false));

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [refreshCustomerInfo, refreshOfferings]);

  useEffect(() => {
    if (!configured || Platform.OS === "web") {
      return;
    }

    const previous = previousUserId.current;
    previousUserId.current = appUserId;

    async function syncIdentity() {
      try {
        if (!previous && appUserId) {
          const result = await Purchases.logIn(appUserId);
          setCustomerInfo(result.customerInfo);
        } else if (previous && !appUserId) {
          const info = await Purchases.getCustomerInfo();
          if (!info.originalAppUserId.startsWith("$RCAnonymousID:")) {
            await Purchases.logOut();
          }
          await refreshCustomerInfo();
        } else if (previous && appUserId && previous !== appUserId) {
          const info = await Purchases.getCustomerInfo();
          if (!info.originalAppUserId.startsWith("$RCAnonymousID:")) {
            await Purchases.logOut();
          }
          const result = await Purchases.logIn(appUserId);
          setCustomerInfo(result.customerInfo);
        }
      } catch (identityError) {
        setError(getErrorMessage(identityError));
      }
    }

    syncIdentity();
  }, [appUserId, configured, refreshCustomerInfo]);

  const purchasePlan = useCallback(
    async (planId: SparkPlanId): Promise<RevenueCatActionResult> => {
      const selectedPackage = matchPackageForPlan(packages, planId);

      if (!selectedPackage) {
        return {
          ok: false,
          message: `RevenueCat offering does not include a ${planId} package yet.`
        };
      }

      try {
        const result = await Purchases.purchasePackage(selectedPackage);
        setCustomerInfo(result.customerInfo);
        await refreshOfferings();
        return { ok: true, customerInfo: result.customerInfo };
      } catch (purchaseError) {
        if (isUserCancelled(purchaseError)) {
          return { ok: false, cancelled: true, message: "Purchase cancelled." };
        }

        return { ok: false, message: getErrorMessage(purchaseError) };
      }
    },
    [packages, refreshOfferings]
  );

  const restorePurchases = useCallback(async (): Promise<RevenueCatActionResult> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return { ok: true, customerInfo: info };
    } catch (restoreError) {
      return { ok: false, message: getErrorMessage(restoreError) };
    }
  }, []);

  const presentPaywallIfNeeded = useCallback(async () => {
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: revenueCatEntitlementId,
        displayCloseButton: true
      });

      await refreshCustomerInfo();

      return (
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED ||
        result === PAYWALL_RESULT.NOT_PRESENTED
      );
    } catch (paywallError) {
      setError(getErrorMessage(paywallError));
      return false;
    }
  }, [refreshCustomerInfo]);

  const openCustomerCenter = useCallback(async (): Promise<RevenueCatActionResult> => {
    try {
      await RevenueCatUI.presentCustomerCenter({
        callbacks: {
          onRestoreCompleted: ({ customerInfo: restoredInfo }) => {
            setCustomerInfo(restoredInfo);
          },
          onPromotionalOfferSucceeded: ({ customerInfo: promoInfo }) => {
            setCustomerInfo(promoInfo);
          }
        }
      });

      const info = await refreshCustomerInfo();
      return { ok: true, customerInfo: info };
    } catch (customerCenterError) {
      return { ok: false, message: getErrorMessage(customerCenterError) };
    }
  }, [refreshCustomerInfo]);

  return useMemo(
    () => ({
      configured,
      isLoading,
      isPro: hasSparknewPro(customerInfo),
      customerInfo,
      packages,
      error,
      refreshCustomerInfo,
      purchasePlan,
      restorePurchases,
      presentPaywallIfNeeded,
      openCustomerCenter
    }),
    [
      configured,
      customerInfo,
      error,
      isLoading,
      openCustomerCenter,
      packages,
      presentPaywallIfNeeded,
      purchasePlan,
      refreshCustomerInfo,
      restorePurchases
    ]
  );
}
