import React, { useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { Text, TextInput } from "../i18n/Text";
import { useThemeState } from "../theme";
import { formatEventDateTimeInput, parseEventDateTimeInput } from "../events";
import { EventPicker } from "./EventPicker";
import { matchingCities, searchKey } from "./event-form-model";

export function EventDateField({ label, value, onChange, allowPast = false }: { label: string; value: string; onChange: (value: string) => void; allowPast?: boolean }) {
  const { palette: c } = useThemeState();
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const iso = parseEventDateTimeInput(value);
  const date = iso ? new Date(iso) : new Date();
  const minimumDate = new Date(); minimumDate.setHours(0, 0, 0, 0);
  if (allowPast && date < minimumDate) minimumDate.setTime(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime());
  const maximumDate = new Date(); maximumDate.setDate(maximumDate.getDate() + 400);
  const button = { minHeight: 52, padding: 13, borderRadius: 15, backgroundColor: c.surfaceStrong, borderWidth: 1, borderColor: c.fillStronger, justifyContent: "center" as const };
  return <View style={{ gap: 8 }}>
    <Text style={{ color: c.ink, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: wybierz datę`} onPress={() => { Keyboard.dismiss(); setMode(mode === "date" ? null : "date"); }} style={{ ...button, flexGrow: 1, flexBasis: 170 }}><Text style={{ color: c.ink, fontSize: 16 }}>{date.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: wybierz godzinę`} onPress={() => { Keyboard.dismiss(); setMode(mode === "time" ? null : "time"); }} style={{ ...button, flexGrow: 1, flexBasis: 90 }}><Text style={{ color: c.ink, fontSize: 16 }}>{date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</Text></Pressable>
    </View>
    {mode && <View style={{ backgroundColor: c.surfaceStrong, padding: 10, borderRadius: 18 }}><EventPicker key={mode} mode={mode} value={date} minimumDate={minimumDate} maximumDate={maximumDate} onChange={(next) => onChange(formatEventDateTimeInput(next))} /><Pressable accessibilityRole="button" accessibilityLabel={`Gotowe: ${label}`} onPress={() => setMode(null)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.event, fontWeight: "700" }}>Gotowe</Text></Pressable></View>}
  </View>;
}

export function EventCityField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { palette: c } = useThemeState();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const cities = matchingCities(query);
  function choose(city: string) { onChange(city.trim()); setOpen(false); Keyboard.dismiss(); }
  return <View style={{ gap: 8 }}>
    <Text style={{ color: c.ink, fontSize: 15, fontWeight: "700" }}>Miasto</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Wybierz miejscowość" onPress={() => { setQuery(""); setOpen(!open); }} style={{ minHeight: 52, borderRadius: 15, backgroundColor: c.surfaceStrong, borderWidth: 1, borderColor: c.fillStronger, padding: 14 }}><Text style={{ color: value ? c.ink : c.muted, fontSize: 16 }}>{value || "Wybierz lub wpisz miejscowość"}</Text></Pressable>
    {open && <View style={{ gap: 4, padding: 10, borderRadius: 18, backgroundColor: c.surfaceStrong }}>
      <TextInput autoFocus accessibilityLabel="Szukaj miejscowości" value={query} onChangeText={setQuery} maxLength={80} placeholder="Szukaj, np. Łódź lub lodz" placeholderTextColor={c.muted} returnKeyType="done" onSubmitEditing={() => query.trim().length >= 2 && choose(query)} style={{ minHeight: 48, color: c.ink, fontSize: 16, padding: 10, backgroundColor: c.fill, borderRadius: 12 }} />
      {cities.map((city) => <Pressable key={city} accessibilityRole="button" onPress={() => choose(city)} style={{ minHeight: 46, padding: 10, justifyContent: "center" }}><Text style={{ color: c.ink, fontSize: 15 }}>{city}</Text></Pressable>)}
      {query.trim().length >= 2 && !cities.some((city) => searchKey(city) === searchKey(query)) && <Pressable accessibilityRole="button" onPress={() => choose(query)} style={{ minHeight: 46, padding: 10, justifyContent: "center" }}><Text style={{ color: c.event, fontSize: 15 }}>Użyj miejscowości: {query.trim()}</Text></Pressable>}
      <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.muted }}>Zamknij listę</Text></Pressable>
    </View>}
  </View>;
}
