import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerDevicePushToken } from "./firestore";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
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
  await registerDevicePushToken(uid, token, Platform.OS);
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
