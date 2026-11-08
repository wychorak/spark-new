import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export type ThemeName = "light" | "dark";
export type ThemePreference = "system" | ThemeName;

export type Palette = {
  name: ThemeName;
  /** Flat page colour and the 3-stop page gradient. */
  background: string;
  backgroundGradient: readonly [string, string, string];
  /** Translucent panels, solid panels, elevated cards, pink-tinted sheets. */
  surface: string;
  surfaceStrong: string;
  card: string;
  cardTinted: string;
  /** Frosted glass used by the new Discover (card header, action bar, switch). */
  glass: string;
  glassStrong: string;
  glassBorder: string;
  ink: string;
  inkSoft: string;
  muted: string;
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  line: string;
  /** Neutral fills/hairlines on top of surfaces (3 strengths). */
  fill: string;
  fillStrong: string;
  fillStronger: string;
  scrim: string;
  onPrimary: string;
  photoPlaceholder: string;
  shadow: string;
  green: string;
  gold: string;
  /** Mode accents for Romantic / Friends / Event. */
  romantic: string;
  friends: string;
  event: string;
  statusBar: "light" | "dark";
  blurTint: "light" | "dark";
};

const dark: Palette = {
  name: "dark",
  background: "#050507",
  backgroundGradient: ["#050507", "#150711", "#050507"],
  surface: "rgba(20,20,26,0.86)",
  surfaceStrong: "#15151c",
  card: "rgba(22,22,29,0.86)",
  cardTinted: "rgba(34,14,27,0.95)",
  glass: "rgba(28,20,30,0.62)",
  glassStrong: "rgba(30,22,32,0.86)",
  glassBorder: "rgba(255,255,255,0.12)",
  ink: "#f8f4f7",
  inkSoft: "#e2c4d3",
  muted: "#a7a0aa",
  primary: "#ff2d8d",
  primaryDeep: "#ff69ad",
  primarySoft: "rgba(255,45,141,0.18)",
  line: "rgba(255,45,141,0.22)",
  fill: "rgba(255,255,255,0.05)",
  fillStrong: "rgba(255,255,255,0.09)",
  fillStronger: "rgba(255,255,255,0.18)",
  scrim: "rgba(5,5,7,0.78)",
  onPrimary: "#ffffff",
  photoPlaceholder: "#111116",
  shadow: "rgba(0,0,0,0.5)",
  green: "#42d982",
  gold: "#ffbd59",
  romantic: "#ff2d8d",
  friends: "#2ed47a",
  event: "#9b6bff",
  statusBar: "light",
  blurTint: "dark"
};

// Light theme: lavender-white glass, deep plum text, Spark pink accent.
const light: Palette = {
  name: "light",
  background: "#f7eff6",
  backgroundGradient: ["#fbf5fa", "#f4e6f1", "#f7eff6"],
  surface: "rgba(255,255,255,0.78)",
  surfaceStrong: "#ffffff",
  card: "rgba(255,255,255,0.86)",
  cardTinted: "rgba(255,241,248,0.97)",
  glass: "rgba(255,255,255,0.58)",
  glassStrong: "rgba(255,255,255,0.84)",
  glassBorder: "rgba(255,255,255,0.95)",
  ink: "#3a0a2a",
  inkSoft: "#6b3a58",
  muted: "#8a7484",
  primary: "#ff1f8e",
  primaryDeep: "#d3127a",
  primarySoft: "rgba(255,31,142,0.12)",
  line: "rgba(255,31,142,0.2)",
  fill: "rgba(90,20,70,0.045)",
  fillStrong: "rgba(90,20,70,0.08)",
  fillStronger: "rgba(90,20,70,0.14)",
  scrim: "rgba(58,10,42,0.38)",
  onPrimary: "#ffffff",
  photoPlaceholder: "#eadbe6",
  shadow: "rgba(120,40,100,0.18)",
  green: "#1fae62",
  gold: "#e09a1a",
  romantic: "#ff1f8e",
  friends: "#16b867",
  event: "#7b4dff",
  statusBar: "dark",
  blurTint: "light"
};

export const palettes: Record<ThemeName, Palette> = { dark, light };

type ThemeState = {
  name: ThemeName;
  palette: Palette;
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
};

const storageKey = "spark.themePreference";
const ThemeContext = createContext<ThemeState>({ name: "dark", palette: dark, preference: "system", setPreference: () => undefined });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((value) => { if (value === "light" || value === "dark" || value === "system") setPreferenceState(value); })
      .catch(() => undefined);
  }, []);

  const value = useMemo<ThemeState>(() => {
    const name: ThemeName = preference === "system" ? (system === "light" ? "light" : "dark") : preference;
    return {
      name,
      palette: palettes[name],
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        AsyncStorage.setItem(storageKey, next).catch(() => undefined);
      }
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeState() {
  return useContext(ThemeContext);
}
