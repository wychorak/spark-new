export type NotificationPreferences = {
  messages: boolean;
  matches: boolean;
  requests: boolean;
  events: boolean;
  sound: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  timeZone: string;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  messages: true,
  matches: true,
  requests: true,
  events: true,
  sound: true,
  quietHoursEnabled: false,
  quietStart: "22:00",
  quietEnd: "08:00",
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw"
};

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const source = typeof value === "object" && value !== null ? value as Partial<NotificationPreferences> : {};
  const validTime = (input: unknown, fallback: string) =>
    typeof input === "string" && /^([01]d|2[0-3]):[0-5]d$/.test(input) ? input : fallback;

  return {
    messages: source.messages !== false,
    matches: source.matches !== false,
    requests: source.requests !== false,
    events: source.events !== false,
    sound: source.sound !== false,
    quietHoursEnabled: source.quietHoursEnabled === true,
    quietStart: validTime(source.quietStart, defaultNotificationPreferences.quietStart),
    quietEnd: validTime(source.quietEnd, defaultNotificationPreferences.quietEnd),
    timeZone: typeof source.timeZone === "string" && source.timeZone.length <= 80
      ? source.timeZone
      : defaultNotificationPreferences.timeZone
  };
}