// Region-aware formatting: dates, clock, distance and height follow the device
// region (en-US gets 12-hour time, miles and feet), while the words follow the
// chosen app language. Stored values stay metric and ISO, so data never changes.
import { getCalendars, getLocales } from "expo-localization";
import { getLanguage } from "./index";
import { setFormatResolver } from "./format";

export { formatDate, formatTime } from "./format";

type DeviceRegion = { regionCode: string | null; measurementSystem: "metric" | "us" | "uk" | null; uses24hourClock: boolean | null };

let cachedDevice: DeviceRegion | null = null;
function device(): DeviceRegion {
  if (cachedDevice) return cachedDevice;
  let regionCode: string | null = null;
  let measurementSystem: DeviceRegion["measurementSystem"] = null;
  let uses24hourClock: boolean | null = null;
  try {
    const locale = getLocales()[0];
    regionCode = locale?.regionCode ? locale.regionCode.toUpperCase() : null;
    measurementSystem = locale?.measurementSystem ?? null;
  } catch {
    // Unknown device locale: metric, 24-hour.
  }
  try {
    uses24hourClock = getCalendars()[0]?.uses24hourClock ?? null;
  } catch {
    uses24hourClock = null;
  }
  cachedDevice = { regionCode, measurementSystem, uses24hourClock };
  return cachedDevice;
}

/** ISO 3166 alpha-2 code of the phone's region, e.g. "US" or "PL". */
export function getDeviceCountryCode(): string | null {
  const code = device().regionCode;
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

/** BCP 47 tag for Intl formatting: app language + device region (en-US, en-GB, pl-PL). */
export function getLocaleTag(): string {
  const language = getLanguage();
  const region = getDeviceCountryCode();
  const candidate = region ? `${language}-${region}` : language;
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([candidate]).length > 0 ? candidate : language;
  } catch {
    return language;
  }
}

export function uses24HourClock(): boolean {
  const fromDevice = device().uses24hourClock;
  if (typeof fromDevice === "boolean") return fromDevice;
  return getDeviceCountryCode() !== "US";
}

/** Miles and feet only where people expect them (US, Liberia, Myanmar; UK uses miles for distance). */
export function usesImperialDistance(): boolean {
  const system = device().measurementSystem;
  return system === "us" || system === "uk";
}

export function usesImperialHeight(): boolean {
  return device().measurementSystem === "us";
}

const kmPerMile = 1.609344;

/** "12 km" or "7 mi"; never below 1. */
export function formatDistance(km: number): string {
  if (usesImperialDistance()) return Math.max(1, Math.round(km / kmPerMile)) + " mi";
  return Math.max(1, Math.round(km)) + " km";
}

/** Distance limits shown in miles where expected; the stored limit stays in km. */
export function distanceLimitLabel(km: number): string {
  if (!usesImperialDistance()) return `${km} km`;
  return `${Math.round(km / kmPerMile)} mi`;
}

/** "184 cm" or "6′0″". */
export function formatHeight(cm: number): string {
  if (!usesImperialHeight()) return `${Math.round(cm)} cm`;
  const totalInches = Math.round(cm / 2.54);
  return `${Math.floor(totalInches / 12)}′${totalInches % 12}″`;
}

setFormatResolver(() => ({ locale: getLocaleTag(), hour12: !uses24HourClock() }));
