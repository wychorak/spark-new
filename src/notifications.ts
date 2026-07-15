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
export type SparkNotificationRoute = "matches" | "messages";

function getRoute(response: Notifications.NotificationResponse): SparkNotificationRoute | null {
  const route = response.notification.request.content.data?.route;
  return route === "matches" || route === "messages" ? route : null;
}

export function observeSparkNotificationResponses(onRoute: (route: SparkNotificationRoute) => void) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const route = getRoute(response);
    if (route) onRoute(route);
  });
  return () => subscription.remove();
}

export async function getInitialSparkNotificationRoute() {
  const response = await Notifications.getLastNotificationResponseAsync();
  return response ? getRoute(response) : null;
}