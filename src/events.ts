export const eventCategoryIds = ["music", "cinema", "sport", "games", "city", "travel"] as const;

export type EventCategoryId = typeof eventCategoryIds[number];
export type SparkEventKind = "specific" | "general";

export type SparkEvent = {
  id: string;
  category: EventCategoryId;
  name: string;
  city: string;
  date: string;
  kind: SparkEventKind;
};

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

export function createEventId(event: Omit<SparkEvent, "id">) {
  return [event.category, event.kind, slug(event.name), slug(event.city), event.date].join(":");
}

export function normalizeSparkEvent(value: unknown): SparkEvent | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<SparkEvent>;
  const category = eventCategoryIds.includes(source.category as EventCategoryId)
    ? source.category as EventCategoryId
    : null;
  const kind = source.kind === "specific" || source.kind === "general" ? source.kind : null;
  const name = cleanText(source.name, 80);
  const city = cleanText(source.city, 80);
  const date = typeof source.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.date) ? source.date : "";

  if (!category || !kind || name.length < 3 || city.length < 2 || !date) return null;
  const event = { category, kind, name, city, date };
  return { ...event, id: createEventId(event) };
}

export function isEventActive(event: SparkEvent, now = Date.now()) {
  const expiresAt = new Date(event.date + "T23:59:59.999").getTime();
  return Number.isFinite(expiresAt) && expiresAt >= now;
}

export function sanitizeActiveEvents(values: unknown, now = Date.now()) {
  if (!Array.isArray(values)) return [];
  const events = new Map<string, SparkEvent>();
  values.forEach((value) => {
    const event = normalizeSparkEvent(value);
    if (event && isEventActive(event, now)) events.set(event.id, event);
  });
  return Array.from(events.values())
    .sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name))
    .slice(0, 8);
}

export function getSharedActiveEvents(viewerEvents: SparkEvent[], profileEvents: SparkEvent[], now = Date.now()) {
  const activeProfileIds = new Set(sanitizeActiveEvents(profileEvents, now).map((event) => event.id));
  return sanitizeActiveEvents(viewerEvents, now).filter((event) => activeProfileIds.has(event.id));
}

export function formatEventDate(date: string) {
  const parsed = new Date(date + "T12:00:00");
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })
    : date;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function endOfFutureMonth(monthOffset: number) {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0));
}

function createSuggestedEvent(category: EventCategoryId, name: string, city: string, date: string, kind: SparkEventKind): SparkEvent {
  const event = { category, name, city, date, kind };
  return { ...event, id: createEventId(event) };
}

export function buildSuggestedEvents(cityInput: string) {
  const city = cleanText(cityInput, 80) || "Kraków";
  return [
    createSuggestedEvent("music", `Koncerty w ${city}`, city, endOfFutureMonth(1), "general"),
    createSuggestedEvent("cinema", "Premiery kinowe", city, endOfFutureMonth(1), "general"),
    createSuggestedEvent("games", "Wieczory planszówkowe", city, endOfFutureMonth(2), "general"),
    createSuggestedEvent("city", `Wyjścia w ${city}`, city, endOfFutureMonth(1), "general"),
    createSuggestedEvent("sport", "Wspólne oglądanie sportu", city, endOfFutureMonth(2), "general"),
    createSuggestedEvent("travel", "Weekendowy wyjazd", city, endOfFutureMonth(3), "general")
  ];
}

export function getBundledTestEvents(profileId: string, city: string) {
  const suggestions = buildSuggestedEvents(city);
  const picks: Record<string, number[]> = {
    spark_test_kuba: [0, 4],
    spark_test_maja: [0, 1, 3],
    spark_test_alex: [2, 3]
  };
  return (picks[profileId] ?? [0]).map((index) => suggestions[index]).filter(Boolean);
}
