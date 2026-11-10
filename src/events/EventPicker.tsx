import React from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useThemeState } from "../theme";
import { getLocaleTag, uses24HourClock } from "../i18n/region";

export function EventPicker({ mode, value, onChange, minimumDate, maximumDate }: { mode: "date" | "time"; value: Date; onChange: (date: Date) => void; minimumDate: Date; maximumDate: Date }) {
  const { name, palette } = useThemeState();
  return <DateTimePicker value={value} mode={mode} display={mode === "date" ? "inline" : "spinner"} locale={getLocaleTag()} is24Hour={uses24HourClock()} themeVariant={name} accentColor={palette.event} minimumDate={mode === "date" ? minimumDate : undefined} maximumDate={mode === "date" ? maximumDate : undefined} onChange={(event, date) => { if (event.type !== "dismissed" && date) onChange(date); }} />;
}
