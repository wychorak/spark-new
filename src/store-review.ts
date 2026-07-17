import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { Platform } from "react-native";

const MATCHES_BEFORE_REVIEW = 2;
const REVIEW_COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000;

export async function registerPositiveMatchForReview(userId: string) {
  if (!userId || Platform.OS === "web") {
    return;
  }

  try {
    const storagePrefix = "spark:store-review:" + userId;
    const matchCountKey = storagePrefix + ":matches";
    const lastReviewKey = storagePrefix + ":last-request";
    const values = await AsyncStorage.multiGet([matchCountKey, lastReviewKey]);
    const previousMatchCount = Number(values[0]?.[1] ?? 0);
    const lastReviewAt = Number(values[1]?.[1] ?? 0);
    const nextMatchCount = previousMatchCount + 1;

    await AsyncStorage.setItem(matchCountKey, String(nextMatchCount));

    if (
      nextMatchCount < MATCHES_BEFORE_REVIEW ||
      Date.now() - lastReviewAt < REVIEW_COOLDOWN_MS ||
      !(await StoreReview.isAvailableAsync())
    ) {
      return;
    }

    await StoreReview.requestReview();
    await AsyncStorage.multiSet([
      [lastReviewKey, String(Date.now())],
      [matchCountKey, "0"]
    ]);
  } catch (error) {
    if (__DEV__) {
      console.warn("Store review request failed", error);
    }
  }
}