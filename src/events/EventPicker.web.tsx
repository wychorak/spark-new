import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Text, TextInput } from "../i18n/Text";
import { formatDate } from "../i18n/format";
import { useThemeState } from "../theme";
import { dateText } from "./event-form-model";

export function EventPicker({ mode, value, onChange, minimumDate, maximumDate }: { mode: "date" | "time"; value: Date; onChange: (date: Date) => void; minimumDate: Date; maximumDate: Date }) {
  const { palette: c } = useThemeState();
  const [hourText, setHourText] = useState(String(value.getHours()).padStart(2, "0"));
  const [minuteText, setMinuteText] = useState(String(value.getMinutes()).padStart(2, "0"));
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const button = { minHeight: 44, minWidth: 44, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 14 };
  if (mode === "time") return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 }}>
    <Text style={{ color: c.inkSoft }}>Godzina</Text>
    <TextInput accessibilityLabel="Godzina wydarzenia" value={hourText} onBlur={() => setHourText(String(value.getHours()).padStart(2, "0"))} keyboardType="number-pad" maxLength={2} onChangeText={(text) => { setHourText(text.replace(/\D/g, "")); const hour = Number(text); if (/^\d{1,2}$/.test(text) && hour <= 23) { const next = new Date(value); next.setHours(hour); onChange(next); } }} style={{ ...button, backgroundColor: c.fillStrong, color: c.ink, textAlign: "center", fontSize: 24, width: 64 }} />
    <Text style={{ color: c.ink, fontSize: 24 }}>:</Text>
    <TextInput accessibilityLabel="Minuty wydarzenia" value={minuteText} onBlur={() => setMinuteText(String(value.getMinutes()).padStart(2, "0"))} keyboardType="number-pad" maxLength={2} onChangeText={(text) => { setMinuteText(text.replace(/\D/g, "")); const minute = Number(text); if (/^\d{1,2}$/.test(text) && minute <= 59) { const next = new Date(value); next.setMinutes(minute); onChange(next); } }} style={{ ...button, backgroundColor: c.fillStrong, color: c.ink, textAlign: "center", fontSize: 24, width: 64 }} />
  </View>;
  const offset = (month.getDay() + 6) % 7;
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Poprzedni miesiąc" disabled={month.getFullYear() * 12 + month.getMonth() <= minimumDate.getFullYear() * 12 + minimumDate.getMonth()} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={button}><Text style={{ color: c.event, fontSize: 28 }}>‹</Text></Pressable>
      <Text style={{ color: c.ink, fontWeight: "700", fontSize: 16 }}>{formatDate(month, { month: "long", year: "numeric" })}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Następny miesiąc" disabled={month.getFullYear() * 12 + month.getMonth() >= maximumDate.getFullYear() * 12 + maximumDate.getMonth()} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={button}><Text style={{ color: c.event, fontSize: 28 }}>›</Text></Pressable>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((day) => <Text key={day} style={{ width: `${100 / 7}%`, textAlign: "center", color: c.muted, paddingBottom: 8 }}>{day}</Text>)}
      {Array.from({ length: 42 }, (_, i) => {
        const day = new Date(month.getFullYear(), month.getMonth(), i - offset + 1);
        const unavailable = day < minimumDate || day > maximumDate || day.getMonth() !== month.getMonth();
        const selected = dateText(day) === dateText(value);
        return <Pressable key={i} accessibilityRole="button" accessibilityLabel={formatDate(day, { day: "numeric", month: "long", year: "numeric" })} accessibilityState={{ selected, disabled: unavailable }} disabled={unavailable} onPress={() => { const next = new Date(value); next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate()); onChange(next); }} style={{ width: `${100 / 7}%`, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: unavailable ? 0.22 : 1 }}><View style={{ ...button, backgroundColor: selected ? c.event : "transparent" }}><Text style={{ color: selected ? c.onPrimary : c.ink, fontWeight: selected ? "800" : "400", fontSize: 16 }}>{day.getDate()}</Text></View></Pressable>;
      })}
    </View>
  </View>;
}
