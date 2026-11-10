// App language. Source texts stay Polish in code; other languages are looked up
// by the Polish text at display time, so stored values (intents, interests,
// genders) never change and any missing translation simply shows in Polish.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { useSyncExternalStore } from "react";
import { Alert, Share, type AlertButton } from "react-native";
import { catalog, catalogLanguages } from "./catalog";

export type Language = "pl" | (typeof catalogLanguages)[number];

export const languageOptions: ReadonlyArray<{ code: Language; label: string }> = [
  { code: "pl", label: "Polski" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "uk", label: "Українська" },
  { code: "es", label: "Español" }
];

const STORAGE_KEY = "spark.language";
const supported = new Set<string>(languageOptions.map((option) => option.code));

function deviceLanguage(): Language {
  try {
    for (const locale of getLocales()) {
      const code = (locale.languageCode ?? "").toLowerCase();
      if (supported.has(code)) return code as Language;
    }
  } catch {
    // Unknown device locale: fall through to English.
  }
  // Any other language worldwide gets English; Polish phones match "pl" above.
  return "en";
}

let current: Language = deviceLanguage();
let column = catalogLanguages.indexOf(current as (typeof catalogLanguages)[number]);
const listeners = new Set<() => void>();
const cache = new Map<string, string>();

type Pattern = { regex: RegExp; key: string; staticLength: number };
let patterns: Pattern[] | null = null;

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPatterns() {
  if (patterns) return patterns;
  patterns = Object.keys(catalog)
    .filter((key) => /\{\d+\}/.test(key))
    .map((key) => {
      const pieces = key.split(/\{\d+\}/);
      return {
        key,
        staticLength: pieces.join("").length,
        regex: new RegExp("^" + pieces.map(escapeRegex).join("([\\s\\S]*?)") + "$")
      };
    })
    .sort((a, b) => b.staticLength - a.staticLength);
  return patterns;
}

function lookup(text: string): string | null {
  if (column < 0) return null;
  const row = catalog[text];
  return row ? row[column] ?? null : null;
}

function lookupLoose(text: string): string | null {
  const exact = lookup(text);
  if (exact !== null) return exact;
  const trimmed = text.trim();
  if (!trimmed || trimmed === text) return null;
  const inner = lookup(trimmed);
  return inner === null ? null : text.replace(trimmed, inner);
}

function translateUncached(text: string): string {
  const direct = lookupLoose(text);
  if (direct !== null) return direct;
  const trimmed = text.trim();
  if (!/[A-Za-zÀ-žА-яЁёІіЇїЄєҐґ]/.test(trimmed)) return text;
  for (const pattern of getPatterns()) {
    const match = pattern.regex.exec(trimmed);
    if (!match) continue;
    const target = lookup(pattern.key);
    if (target === null) continue;
    const filled = target.replace(/\{(\d+)\}/g, (_, index: string) => {
      const value = match[Number(index) + 1] ?? "";
      return lookupLoose(value) ?? value;
    });
    return text.replace(trimmed, filled);
  }
  return text;
}

/** Translate a Polish source text into the current language (Polish = unchanged). */
export function tr(text: string): string {
  if (column < 0 || !text) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const result = translateUncached(text);
  if (cache.size > 4000) cache.clear();
  cache.set(text, result);
  return result;
}

export function getLanguage() {
  return current;
}

function apply(language: Language) {
  if (language === current) return;
  current = language;
  column = catalogLanguages.indexOf(language as (typeof catalogLanguages)[number]);
  cache.clear();
  listeners.forEach((listener) => listener());
}

export function setLanguage(language: Language) {
  if (!supported.has(language)) return;
  apply(language);
  AsyncStorage.setItem(STORAGE_KEY, language).catch(() => undefined);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

// A saved choice wins over the device language.
AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (saved && supported.has(saved)) apply(saved as Language);
  })
  .catch(() => undefined);

// Alerts and the share sheet are built from Polish strings all over the app.
const nativeAlert = Alert.alert.bind(Alert);
Alert.alert = (title: string, message?: string, buttons?: AlertButton[], options?: Parameters<typeof Alert.alert>[3]) =>
  nativeAlert(
    tr(title),
    message ? tr(message) : message,
    buttons?.map((button) => (button.text ? { ...button, text: tr(button.text) } : button)),
    options
  );

const nativeShare = Share.share.bind(Share);
Share.share = (content, options) => {
  const translated = { ...content } as { message?: string; title?: string; url?: string };
  if (translated.message) translated.message = tr(translated.message);
  if (translated.title) translated.title = tr(translated.title);
  return nativeShare(translated as Parameters<typeof Share.share>[0], options);
};
