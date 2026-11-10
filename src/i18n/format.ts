// Dependency-free date/time formatting so plain modules (and node tests) can use
// it. src/i18n/region.ts plugs in the device locale and clock at app start.
type FormatSettings = { locale: string; hour12: boolean };
let resolve: () => FormatSettings = () => ({ locale: "pl-PL", hour12: false });

export function setFormatResolver(resolver: () => FormatSettings) {
  resolve = resolver;
}

export function formatTime(value: Date | number | string): string {
  const { locale, hour12 } = resolve();
  return new Date(value).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", hour12 });
}

export function formatDate(value: Date | number | string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Date(value).toLocaleDateString(resolve().locale, options);
}
