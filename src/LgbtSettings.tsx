import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { LgbtSettings } from "./firestore";
import { LGBT_LABELS } from "./discover/DiscoverParts";
import { palettes, useThemeState, type Palette } from "./theme";

const IDENTITIES = ["gej", "lesbijka", "bi", "pan", "queer", "trans", "niebinarna", "ace", "aro", "interseks", "szukam"] as const;
const MAX_IDENTITIES = 5;

/**
 * Optional LGBT+ tag. Stored privately; the server shows it to everyone or
 * only to other LGBT+ people, as chosen here. Turning it off removes it.
 */
export function LgbtSettingsPanel({ value, onChange, busy }: { value: LgbtSettings | null; onChange: (value: LgbtSettings) => void; busy?: boolean }) {
  const theme = useThemeState();
  const c = theme.palette;
  const styles = sheets[theme.name];
  const current: LgbtSettings = value ?? { member: false, identities: [], visibility: "lgbt" };

  function toggleIdentity(id: string) {
    const has = current.identities.includes(id);
    if (!has && current.identities.length >= MAX_IDENTITIES) return;
    onChange({ ...current, identities: has ? current.identities.filter((item) => item !== id) : [...current.identities, id] });
  }

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Text style={styles.flag}>🏳️‍🌈</Text>
        <View style={styles.fill}>
          <Text style={styles.title}>Tag LGBT+</Text>
          <Text style={styles.hint}>Opcjonalny. Możesz go w każdej chwili wyłączyć — wtedy znika z profilu.</Text>
        </View>
        <Switch
          accessibilityLabel="Należę do społeczności LGBT+"
          disabled={busy}
          value={current.member}
          onValueChange={(member) => onChange(member ? { ...current, member } : { member: false, identities: [], visibility: "lgbt" })}
          trackColor={{ true: c.primary }}
        />
      </View>

      {current.member && (
        <>
          <Text style={styles.label}>Jak się określasz? (do {MAX_IDENTITIES})</Text>
          <View style={styles.chips}>
            {IDENTITIES.map((id) => {
              const active = current.identities.includes(id);
              return (
                <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: active }} disabled={busy} onPress={() => toggleIdentity(id)} style={[styles.chip, active && styles.chipActive]}>
                  {active && <MaterialCommunityIcons name="check" size={14} color={c.onPrimary} />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{LGBT_LABELS[id]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>Kto widzi tag</Text>
          <View style={styles.segmented}>
            {([["everyone", "Wszyscy", "earth"], ["lgbt", "Tylko osoby LGBT+", "account-heart"]] as const).map(([key, label, icon]) => {
              const active = current.visibility === key;
              return (
                <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }} disabled={busy} onPress={() => onChange({ ...current, visibility: key })} style={[styles.segment, active && styles.segmentActive]}>
                  <MaterialCommunityIcons name={icon} size={16} color={active ? c.onPrimary : c.inkSoft} />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {current.visibility === "everyone"
              ? "Tag zobaczy każdy na Twojej karcie, a osoby z filtrem „Tylko LGBT+” łatwiej Cię znajdą."
              : "Tag zobaczą tylko inne osoby z tagiem LGBT+. Dla pozostałych Twój profil wygląda zwyczajnie."}
          </Text>
        </>
      )}
    </View>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    panel: { gap: 12, padding: 16, borderRadius: 22, backgroundColor: c.fill, borderWidth: 1, borderColor: c.fillStrong },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    fill: { flex: 1 },
    flag: { fontSize: 24 },
    title: { color: c.ink, fontSize: 16, fontWeight: "900" },
    hint: { color: c.muted, fontSize: 13, lineHeight: 18 },
    label: { color: c.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.6 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: c.surfaceStrong, borderWidth: 1, borderColor: c.fillStrong },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.ink, fontSize: 14, fontWeight: "700" },
    chipTextActive: { color: c.onPrimary },
    segmented: { flexDirection: "row", gap: 6, padding: 4, borderRadius: 16, backgroundColor: c.surfaceStrong },
    segment: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 42, borderRadius: 13, paddingHorizontal: 6 },
    segmentActive: { backgroundColor: c.primary },
    segmentText: { color: c.inkSoft, fontSize: 13, fontWeight: "800" },
    segmentTextActive: { color: c.onPrimary }
  });
}

const sheets = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };
