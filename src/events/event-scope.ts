// Event reach (local / national / global), the catalog filters and sorting.
// Kept free of React so it can be tested directly.
import type { EventCategoryId, SparkEvent } from "../events";
import { searchKey } from "./event-form-model";

export type EventScope = "local" | "national" | "global";
export type EventScaleFilter = "all" | EventScope;
export type EventSort = "nearby" | "soonest" | "name";

export const eventScopes: ReadonlyArray<{ id: EventScope; label: string; hint: string; icon: string }> = [
  { id: "local", label: "Lokalne", hint: "W jednym mieście", icon: "map-marker-outline" },
  { id: "national", label: "Krajowe", hint: "Dla całego kraju", icon: "flag-outline" },
  { id: "global", label: "Globalne", hint: "Dla wszystkich", icon: "earth" }
];

export const eventSorts: ReadonlyArray<{ id: EventSort; label: string }> = [
  { id: "nearby", label: "Najbliżej mnie" },
  { id: "soonest", label: "Najwcześniej" },
  { id: "name", label: "Nazwa A–Z" }
];

/** Countries offered for national events (Polish names are the i18n source strings). */
export const eventCountries: ReadonlyArray<{ code: string; name: string }> = [
  ["PL", "Polska"], ["US", "Stany Zjednoczone"], ["GB", "Wielka Brytania"], ["DE", "Niemcy"], ["ES", "Hiszpania"],
  ["UA", "Ukraina"], ["FR", "Francja"], ["IT", "Włochy"], ["NL", "Holandia"], ["BE", "Belgia"], ["CZ", "Czechy"],
  ["SK", "Słowacja"], ["AT", "Austria"], ["CH", "Szwajcaria"], ["IE", "Irlandia"], ["PT", "Portugalia"], ["SE", "Szwecja"],
  ["NO", "Norwegia"], ["DK", "Dania"], ["FI", "Finlandia"], ["LT", "Litwa"], ["LV", "Łotwa"], ["EE", "Estonia"],
  ["HU", "Węgry"], ["RO", "Rumunia"], ["BG", "Bułgaria"], ["HR", "Chorwacja"], ["SI", "Słowenia"], ["GR", "Grecja"],
  ["CA", "Kanada"], ["MX", "Meksyk"], ["BR", "Brazylia"], ["AR", "Argentyna"], ["AU", "Australia"], ["JP", "Japonia"],
  ["KR", "Korea Południowa"], ["TR", "Turcja"], ["AE", "Zjednoczone Emiraty Arabskie"]
].map(([code, name]) => ({ code, name }));

export function eventCountryName(code: string | undefined) {
  return eventCountries.find((item) => item.code === code)?.name ?? code ?? "";
}

type ScopeDetails = { scope?: string; countryCode?: string } | undefined;

/** Events from before scopes existed are local; events from before country codes are Polish. */
export function eventScopeOf(details: ScopeDetails): EventScope {
  return details?.scope === "national" || details?.scope === "global" ? details.scope : "local";
}

export function eventCountryOf(details: ScopeDetails) {
  return details?.countryCode && /^[A-Z]{2}$/.test(details.countryCode) ? details.countryCode : "PL";
}

export function isInCity(eventCity: string, userCity: string) {
  const eventKey = searchKey(eventCity), cityKey = searchKey(userCity);
  if (!eventKey || !cityKey) return false;
  return eventKey === cityKey || (Math.min(eventKey.length, cityKey.length) >= 4 && (eventKey.includes(cityKey) || cityKey.includes(eventKey)));
}

/** Global events reach everyone; local and national ones only people in their country. */
export function isEventVisibleTo(details: ScopeDetails, userCountryCode: string) {
  return eventScopeOf(details) === "global" || eventCountryOf(details) === userCountryCode;
}

export function matchesScale(event: SparkEvent, details: ScopeDetails, scale: EventScaleFilter, userCity: string) {
  if (scale === "all") return true;
  const scope = eventScopeOf(details);
  if (scale !== scope) return false;
  // "Local" means the person's own city when it is known.
  return scope !== "local" || !searchKey(userCity) || isInCity(event.city, userCity);
}

export type EventCatalogOptions = {
  userCountryCode: string;
  userCity: string;
  scale: EventScaleFilter;
  category: "all" | EventCategoryId;
  sort: EventSort;
  query?: string;
  detailsText?: (event: SparkEvent) => string;
};

export function filterAndSortEvents(events: SparkEvent[], details: Record<string, ScopeDetails>, options: EventCatalogOptions) {
  const query = searchKey(options.query ?? "");
  const rank = (event: SparkEvent) => {
    // Nearby: my city, then my whole country, then the rest of the world.
    const scope = eventScopeOf(details[event.id]);
    if (isInCity(event.city, options.userCity)) return 0;
    if (scope === "national" && eventCountryOf(details[event.id]) === options.userCountryCode) return 1;
    if (scope === "local") return 2;
    return 3;
  };
  return events
    .filter((event) => isEventVisibleTo(details[event.id], options.userCountryCode)
      && (options.category === "all" || event.category === options.category)
      && matchesScale(event, details[event.id], options.scale, options.userCity)
      && (!query || searchKey(`${event.name} ${event.city} ${options.detailsText?.(event) ?? ""}`).includes(query)))
    .sort((a, b) => {
      if (options.sort === "name") return a.name.localeCompare(b.name, "pl");
      const byDate = Date.parse(a.startsAt) - Date.parse(b.startsAt);
      return options.sort === "nearby" ? rank(a) - rank(b) || byDate : byDate;
    });
}

/** How many events each reach filter would show (category and search applied). */
export function countByScale(events: SparkEvent[], details: Record<string, ScopeDetails>, options: Omit<EventCatalogOptions, "scale" | "sort">) {
  const count = (scale: EventScaleFilter) => filterAndSortEvents(events, details, { ...options, scale, sort: "soonest" }).length;
  return { all: count("all"), local: count("local"), national: count("national"), global: count("global") } satisfies Record<EventScaleFilter, number>;
}
