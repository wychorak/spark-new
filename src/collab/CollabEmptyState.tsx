import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../i18n/Text";
import { palettes, useThemeState, type Palette } from "../theme";
import { collabLabel } from "../collab";

/** Body of the Collab feed with nobody to show: not set up, loading, error or no match.
 *  Rendered inside the standard empty Discover screen, so the header and menu stay. */
export function CollabEmptyState({ ready, looking, loading, error, onEdit, onRetry }: {
  ready: boolean;
  looking: string[];
  loading: boolean;
  error: string | null;
  onEdit: () => void;
  onRetry: () => void;
}) {
  const theme = useThemeState();
  const c = theme.palette;
  const styles = sheets[theme.name];
  const title = !ready ? "Ustaw swój profil Collab" : loading ? "Szukamy osób do współpracy" : error ? "Nie udało się wczytać" : "Na razie nikogo nie ma";
  const text = !ready
    ? "Powiedz, co robisz i kogo szukasz. Pokażemy Ci producentów, raperów, grafików, programistów i innych twórców do wspólnego projektu."
    : loading ? "" : error ? error
      : "Nikt w okolicy nie oferuje teraz tego, czego szukasz. Dodaj więcej rzeczy w „Kogo szukasz” albo włącz współpracę zdalną.";
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.icon}>
          {loading && ready ? <ActivityIndicator color={c.collab} /> : <MaterialCommunityIcons name="handshake-outline" size={34} color={c.collab} />}
        </View>
        <Text style={styles.title}>{title}</Text>
        {!!text && <Text style={styles.text}>{text}</Text>}
        {ready && looking.length > 0 && !loading && (
          <View style={styles.chips}>
            {looking.map((id) => <View key={id} style={styles.chip}><Text style={styles.chipText}>{collabLabel(id)}</Text></View>)}
          </View>
        )}
        {!loading && (
          <Pressable accessibilityRole="button" onPress={error ? onRetry : onEdit} style={styles.button}>
            <MaterialCommunityIcons name={error ? "refresh" : "pencil-outline"} size={18} color={c.onPrimary} />
            <Text style={styles.buttonText}>{error ? "Spróbuj ponownie" : ready ? "Edytuj profil Collab" : "Ustaw profil Collab"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "center", paddingTop: 12 },
    card: { alignItems: "center", gap: 12, padding: 24, borderRadius: 24, backgroundColor: c.fill, borderWidth: 1, borderColor: c.fillStrong },
    icon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceStrong },
    title: { color: c.ink, fontSize: 20, fontWeight: "900", textAlign: "center" },
    text: { maxWidth: 320, color: c.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
    chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: c.surfaceStrong },
    chipText: { color: c.ink, fontSize: 12, fontWeight: "700" },
    button: { marginTop: 4, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, borderRadius: 15, backgroundColor: c.collab },
    buttonText: { color: c.onPrimary, fontSize: 15, fontWeight: "900" }
  });
}

const sheets = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };
