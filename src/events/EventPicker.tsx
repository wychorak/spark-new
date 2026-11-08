import React from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useThemeState } from "../theme";

export function EventPicker({ mode, value, onChange, minimumDate, maximumDate }: { mode: "date" | "time"; value: Date; onChange: (date: Date) => void; minimumDate: Date; maximumDate: Date }) {
  const { name, palette } = useThemeState();
  return <DateTimePicker value={value} mode={mode} display={mode === "date" ? "inline" : "spinner"} locale="pl-PL" is24Hour themeVariant={name} accentColor={palette.event} minimumDate={mode === "date" ? minimumDate : undefined} maximumDate={mode === "date" ? maximumDate : undefined} onChange={(event, date) => { if (event.type !== "dismissed" && date) onChange(date); }} />;
}
