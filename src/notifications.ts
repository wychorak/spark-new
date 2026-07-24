import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { loadNotificationPreferences, registerDevicePushToken } from "./firestore";
import { defaultNotificationPreferences, normalizeNotificationPreferences, type NotificationPreferences } from "./notification-preferences";

let activeNotificationPreferences = defaultNotificationPreferences;

function isQuietHours(preferences: NotificationPreferences) {
  if (!preferences.quietHoursEnabled) return false;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = preferences.quietStart.split(":").map(Number);
  const [endHour, endMinute] = preferences.quietEnd.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

export function setActiveNotificationPreferences(preferences: NotificationPreferences) {
  activeNotificationPreferences = normalizeNotificationPreferences(preferences);
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const category = String(notification.request.content.data?.category ?? "messages") as keyof NotificationPreferences;
    const categoryEnabled = typeof activeNotificationPreferences[category] === "boolean"
      ? Boolean(activeNotificationPreferences[category])
      : true;
    const quiet = isQuietHours(activeNotificationPreferences);
    return {
      shouldShowBanner: categoryEnabled && !quiet,
      shouldShowList: categoryEnabled,
      shouldPlaySound: categoryEnabled && !quiet && activeNotificationPreferences.sound,
      shouldSetBadge: categoryEnabled
    };
  }
});

export async function registerSparkPushNotifications(uid: string) {
  if (!Device.isDevice || (Platform.OS !== "ios" && Platform.OS !== "android")) {
    return false;
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return false;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error("Brakuje identyfikatora projektu EAS dla powiadomień.");
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const preferences = await loadNotificationPreferences(uid);
  setActiveNotificationPreferences(preferences);
  await registerDevicePushToken(uid, token, Platform.OS, preferences);
  return true;
}
export type SparkNotificationTarget = {
  route: "matches" | "messages" | "eventFriends";
  threadId?: string;
  eventId?: string;
};

function getTarget(response: Notifications.NotificationResponse): SparkNotificationTarget | null {
  const data = response.notification.request.content.data;
  const route = data?.route;
  if (route !== "matches" && route !== "messages" && route !== "eventFriends") return null;
  return {
    route,
    threadId: typeof data?.threadId === "string" ? data.threadId : undefined,
    eventId: typeof data?.eventId === "string" ? data.eventId : undefined
  };
}

export function observeSparkNotificationResponses(onTarget: (target: SparkNotificationTarget) => void) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const target = getTarget(response);
    if (target) onTarget(target);
  });
  return () => subscription.remove();
}

export async function getInitialSparkNotificationRoute() {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;
  const target = getTarget(response);
  await Notifications.clearLastNotificationResponseAsync();
  return target;
}

export async function setSparkAppBadgeCount(count: number) {
  if (Platform.OS === "web") return;
  await Notifications.setBadgeCountAsync(Math.max(0, Math.min(999, Math.floor(count))));
}
