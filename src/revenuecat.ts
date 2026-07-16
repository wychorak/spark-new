import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesOfferings,
  type PurchasesPackage
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

export const revenueCatEntitlementId =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "Sparknew Pro";

export const revenueCatOfferingId = process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID || "Spark pro offer";

export const revenueCatProductIds = {
  weekly: process.env.EXPO_PUBLIC_REVENUECAT_WEEKLY_PRODUCT_ID || "sparkproweek",
  monthly: process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID || "sparkpromonth",
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
  prices: Partial<Record<SparkPlanId, string>>;
  error: string | null;
  refreshCustomerInfo: () => Promise<CustomerInfo | null>;
  purchasePlan: (planId: SparkPlanId) => Promise<RevenueCatActionResult>;
  restorePurchases: () => Promise<RevenueCatActionResult>;
  presentPaywallIfNeeded: () => Promise<boolean>;
  openCustomerCenter: () => Promise<RevenueCatActionResult>;
};

let didConfigureRevenueCat = false;

function getRevenueCatApiKey() {
  return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || (__DEV__ ? "test_ZXrasnBoneOhTMZGyJXoPEEacNC" : "");
}

function isRevenueCatApiKeyUsable(apiKey: string) {
  return Boolean(apiKey) && (__DEV__ || !apiKey.startsWith("test_"));
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
  const productId = revenueCatProductIds[planId].toLowerCase();

  return packages.find((item) => {
    const candidateValues = [
      item.identifier,
      item.packageType,
      item.product.identifier
    ].map((value) => String(value).toLowerCase());

    return candidateValues.some((value) => value.includes(productId));
  });
}

function getPreferredOffering(offerings: PurchasesOfferings) {
  const allOfferings = Object.values(offerings.all);

  return (
    offerings.all[revenueCatOfferingId] ??
    allOfferings.find((offering) => offering.identifier.toLowerCase() === revenueCatOfferingId.toLowerCase()) ??
    offerings.current ??
    null
  );
}

function getOfferingWithPackages(offerings: PurchasesOfferings) {
  const preferredOffering = getPreferredOffering(offerings);
  const candidates = [preferredOffering, offerings.current, ...Object.values(offerings.all)].filter(
    (offering): offering is PurchasesOffering => Boolean(offering)
  );

  return candidates.find((offering) => offering.availablePackages.length > 0) ?? preferredOffering;
}
export function useRevenueCat(appUserId: string | null, ownerAccess = false): RevenueCatState {
  const [configured, setConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prices = useMemo(() => (
    (Object.keys(revenueCatProductIds) as SparkPlanId[]).reduce<Partial<Record<SparkPlanId, string>>>((result, planId) => {
      const product = matchPackageForPlan(packages, planId)?.product;
      if (product?.priceString) result[planId] = product.priceString;
      return result;
    }, {})
  ), [packages]);

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
      const selectedOffering = getOfferingWithPackages(offerings);
      setPackages(selectedOffering?.availablePackages ?? []);
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

    const apiKey = getRevenueCatApiKey();

    if (!isRevenueCatApiKeyUsable(apiKey)) {
      setConfigured(false);
      setIsLoading(false);
      setError("RevenueCat iOS public SDK key is missing or uses a test_ simulated-store key.");
      return undefined;
    }

    if (!didConfigureRevenueCat) {
      Purchases.configure({ apiKey });
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

    async function syncIdentity() {
      try {
        const revenueCatUserId = await Purchases.getAppUserID();
        const isAnonymous = revenueCatUserId.startsWith("$RCAnonymousID:");

        if (!appUserId) {
          if (!isAnonymous) {
            setCustomerInfo(await Purchases.logOut());
          } else {
            await refreshCustomerInfo();
          }
        } else if (revenueCatUserId === appUserId) {
          await refreshCustomerInfo();
        } else {
          if (!isAnonymous) {
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
        if (!ownerAccess && !hasSparknewPro(result.customerInfo)) {
          return {
            ok: false,
            message: `Zakup zakończony, ale produkt nie aktywował dostępu ${revenueCatEntitlementId}. Sprawdź przypisanie produktu do entitlementu w RevenueCat.`
          };
        }
        return { ok: true, customerInfo: result.customerInfo };
      } catch (purchaseError) {
        if (isUserCancelled(purchaseError)) {
          return { ok: false, cancelled: true, message: "Purchase cancelled." };
        }

        return { ok: false, message: getErrorMessage(purchaseError) };
      }
    },
    [ownerAccess, packages, refreshOfferings]
  );

  const restorePurchases = useCallback(async (): Promise<RevenueCatActionResult> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      if (!ownerAccess && !hasSparknewPro(info)) {
        return { ok: false, message: "Nie znaleziono aktywnego dostępu Spark Pro do przywrócenia." };
      }
      return { ok: true, customerInfo: info };
    } catch (restoreError) {
      return { ok: false, message: getErrorMessage(restoreError) };
    }
  }, [ownerAccess]);

  const presentPaywallIfNeeded = useCallback(async () => {
    if (ownerAccess) return true;

    try {
      const offerings = await Purchases.getOfferings();
      const offering = getOfferingWithPackages(offerings);
      setPackages(offering?.availablePackages ?? []);

      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: revenueCatEntitlementId,
        offering,
        displayCloseButton: true
      });

      const refreshedInfo = await refreshCustomerInfo();
      const completed = result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED || result === PAYWALL_RESULT.NOT_PRESENTED;
      return completed && hasSparknewPro(refreshedInfo);
    } catch (paywallError) {
      setError(getErrorMessage(paywallError));
      return false;
    }
  }, [ownerAccess, refreshCustomerInfo]);

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
      isPro: ownerAccess || hasSparknewPro(customerInfo),
      customerInfo,
      packages,
      prices,
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
      ownerAccess,
      packages,
      prices,
      presentPaywallIfNeeded,
      purchasePlan,
      refreshCustomerInfo,
      restorePurchases
    ]
  );
}
