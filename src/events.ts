export const eventCategoryIds = ["music", "cinema", "sport", "games", "city", "travel"] as const;

export type EventCategoryId = typeof eventCategoryIds[number];
export type SparkEventKind = "specific";

export type SparkEvent = {
  id: string;
  category: EventCategoryId;
  name: string;
  city: string;
  date: string;
  kind: SparkEventKind;
  startsAt: string;
  endsAt: string;
};

export const maxSelectedEvents = 4;
export const eventExpiryDelayMs = 60 * 60 * 1000;

export const eventCategories: Array<{
  id: EventCategoryId;
  label: string;
  hint: string;
  icon: string;
}> = [
  { id: "music", label: "Muzyka", hint: "Koncerty i festiwale", icon: "music-circle" },
  { id: "cinema", label: "Kino", hint: "Premiery i maratony", icon: "movie-open-outline" },
  { id: "sport", label: "Sport", hint: "Mecze i aktywność", icon: "stadium-outline" },
  { id: "games", label: "Gry", hint: "Gaming i planszówki", icon: "controller-classic-outline" },
  { id: "city", label: "Miasto", hint: "Wyjścia i kultura", icon: "city-variant-outline" },
  { id: "travel", label: "Wyjazdy", hint: "Weekend i podróże", icon: "train-car" }
];

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
}

function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return Number.isFinite(new Date(value).getTime());
}

function legacyDateRange(date: string) {
  return {
    startsAt: new Date(date + "T12:00:00").toISOString(),
    endsAt: new Date(date + "T23:59:59").toISOString()
  };
}

export function createEventId(event: Omit<SparkEvent, "id" | "date" | "kind">) {
  return [event.category, slug(event.name), slug(event.city), event.startsAt.slice(0, 16), event.endsAt.slice(0, 16)]
    .join(":")
    .replace(/[^a-zA-Z0-9:_-]/g, "-")
    .slice(0, 220);
}

export function normalizeSparkEvent(value: unknown): SparkEvent | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<SparkEvent>;
  const sourceKind = (value as { kind?: unknown }).kind;
  const category = eventCategoryIds.includes(source.category as EventCategoryId)
    ? source.category as EventCategoryId
    : null;
  const name = cleanText(source.name, 80);
  const city = cleanText(source.city, 80);
  const legacyDate = typeof source.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.date) ? source.date : "";
  const legacyRange = legacyDate ? legacyDateRange(legacyDate) : null;
  const startsAt = isIsoDateTime(source.startsAt) ? source.startsAt : legacyRange?.startsAt ?? "";
  const endsAt = isIsoDateTime(source.endsAt) ? source.endsAt : legacyRange?.endsAt ?? "";
  const startsAtMs = new Date(startsAt).getTime();
  const endsAtMs = new Date(endsAt).getTime();

  if (!category || sourceKind === "general" || name.length < 3 || city.length < 2 || !startsAt || !endsAt) return null;
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs) || endsAtMs <= startsAtMs) return null;
  const eventBase = { category, name, city, startsAt, endsAt };
  return {
    ...eventBase,
    id: createEventId(eventBase),
    date: startsAt.slice(0, 10),
    kind: "specific"
  };
}

export function isEventActive(event: SparkEvent, now = Date.now()) {
  const expiresAt = new Date(event.endsAt).getTime() + eventExpiryDelayMs;
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function sanitizeActiveEvents(values: unknown, now = Date.now()) {
  if (!Array.isArray(values)) return [];
  const events = new Map<string, SparkEvent>();
  values.forEach((value) => {
    const event = normalizeSparkEvent(value);
    if (event && isEventActive(event, now)) events.set(event.id, event);
  });
  return Array.from(events.values())
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.name.localeCompare(right.name))
    .slice(0, maxSelectedEvents);
}

export function getSharedActiveEvents(viewerEvents: SparkEvent[], profileEvents: SparkEvent[], now = Date.now()) {
  const activeProfileIds = new Set(sanitizeActiveEvents(profileEvents, now).map((event) => event.id));
  return sanitizeActiveEvents(viewerEvents, now).filter((event) => activeProfileIds.has(event.id));
}

export function formatEventDate(dateOrEvent: string | SparkEvent) {
  const date = typeof dateOrEvent === "string"
    ? new Date(dateOrEvent.length === 10 ? dateOrEvent + "T12:00:00" : dateOrEvent)
    : new Date(dateOrEvent.startsAt);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })
    : typeof dateOrEvent === "string" ? dateOrEvent : dateOrEvent.date;
}

export function formatEventDateRange(event: SparkEvent) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return event.date;
  const sameDay = start.toDateString() === end.toDateString();
  const startLabel = start.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  const startTime = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const endLabel = sameDay ? "" : end.toLocaleDateString("pl-PL", { day: "numeric", month: "short" }) + ", ";
  const endTime = end.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return `${startLabel}, ${startTime} – ${endLabel}${endTime}`;
}

export function formatEventDateTimeInput(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function parseEventDateTimeInput(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hours, minutes] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), 0, 0);
  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
    || date.getHours() !== Number(hours)
    || date.getMinutes() !== Number(minutes)
  ) return null;
  return date.toISOString();
}

export function getDefaultEventDateTimes(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start);
  end.setHours(21, 0, 0, 0);
  return {
    start: formatEventDateTimeInput(start),
    end: formatEventDateTimeInput(end)
  };
}
