import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "../i18n/Text";
import { palettes, useThemeState, type Palette } from "../theme";
import {
  collabCategories,
  collabLabel,
  collabMaxLooking,
  collabMaxSkills,
  collabPitchMaxLength,
  collabPortfolioMaxLength,
  isCollabReady,
  normalizeCollabPortfolio,
  type CollabProfile
} from "../collab";

type Section = "skills" | "looking";

/** Picks skills, wanted skills, a pitch, remote work and one portfolio link. */
export function CollabEditorModal({ visible, value, onClose, onSave }: {
  visible: boolean;
  value: CollabProfile;
  onClose: () => void;
  onSave: (value: CollabProfile) => Promise<boolean>;
}) {
  const theme = useThemeState();
  const c = theme.palette;
  const styles = sheets[theme.name];
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<CollabProfile>(value);
  const [openCategory, setOpenCategory] = useState<Record<Section, string | null>>({ skills: null, looking: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setError(null);
    setOpenCategory({ skills: value.skills.length ? null : collabCategories[0].id, looking: null });
  }, [visible]);

  function toggle(section: Section, id: string) {
    setError(null);
    setDraft((current) => {
      const key = section === "skills" ? "skills" : "looking";
      const max = section === "skills" ? collabMaxSkills : collabMaxLooking;
      const list = current[key];
      if (list.includes(id)) return { ...current, [key]: list.filter((item) => item !== id) };
      if (list.length >= max) return current;
      return { ...current, [key]: [...list, id] };
    });
  }

  async function save() {
    if (!isCollabReady(draft)) {
      setError("Wybierz co najmniej jedną rzecz, którą robisz, i jedną, której szukasz.");
      return;
    }
    const portfolio = draft.portfolio.trim() ? normalizeCollabPortfolio(draft.portfolio) : "";
    if (draft.portfolio.trim() && !portfolio) {
      setError("Link do portfolio wygląda na nieprawidłowy. Wklej pełny adres strony.");
      return;
    }
    setSaving(true);
    const ok = await onSave({ ...draft, portfolio });
    setSaving(false);
    if (ok) onClose();
    else setError("Nie udało się zapisać. Spróbuj ponownie.");
  }

  async function leave() {
    setSaving(true);
    const ok = await onSave({ skills: [], looking: [], pitch: "", remote: false, portfolio: "", hasPortfolio: false });
    setSaving(false);
    if (ok) onClose();
    else setError("Nie udało się zapisać. Spróbuj ponownie.");
  }

  function picker(section: Section) {
    const selected = section === "skills" ? draft.skills : draft.looking;
    const max = section === "skills" ? collabMaxSkills : collabMaxLooking;
    return (
      <View style={styles.block}>
        {selected.length > 0 && (
          <View style={styles.chips}>
            {selected.map((id) => (
              <Pressable key={id} accessibilityRole="button" accessibilityLabel={collabLabel(id)} onPress={() => toggle(section, id)} style={[styles.chip, styles.chipActive]}>
                <Text style={[styles.chipText, styles.chipTextActive]}>{collabLabel(id)}</Text>
                <MaterialCommunityIcons name="close" size={14} color={c.onPrimary} />
              </Pressable>
            ))}
          </View>
        )}
        <Text style={styles.counter}>{selected.length}/{max}</Text>
        {collabCategories.map((category) => {
          const open = openCategory[section] === category.id;
          const count = category.items.filter((item) => selected.includes(item.id)).length;
          return (
            <View key={category.id} style={styles.category}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setOpenCategory((current) => ({ ...current, [section]: open ? null : category.id }))}
                style={styles.categoryHeader}
              >
                <MaterialCommunityIcons name={category.icon as any} size={20} color={c.collab} />
                <Text style={styles.categoryTitle}>{category.label}</Text>
                {count > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View>}
                <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color={c.muted} />
              </Pressable>
              {open && (
                <View style={styles.chips}>
                  {category.items.map((item) => {
                    const active = selected.includes(item.id);
                    const disabled = !active && selected.length >= max;
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active, disabled }}
                        disabled={disabled}
                        onPress={() => toggle(section, item.id)}
                        style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                      >
                        {active && <MaterialCommunityIcons name="check" size={14} color={c.onPrimary} />}
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.root, { paddingTop: Platform.OS === "android" ? insets.top : 0 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zamknij" onPress={onClose} style={styles.close}>
            <MaterialCommunityIcons name="close" size={20} color={c.ink} />
          </Pressable>
          <View style={styles.fill}>
            <Text style={styles.eyebrow}>Collab</Text>
            <Text style={styles.title}>Twój profil współpracy</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Znajdź ludzi do wspólnego projektu: muzyki, klipu, aplikacji, sesji zdjęciowej. W trybie Collab zobaczysz osoby, które robią to, czego szukasz.</Text>

          <Text style={styles.sectionTitle}>Co robisz?</Text>
          <Text style={styles.hint}>Wybierz do {collabMaxSkills} umiejętności.</Text>
          {picker("skills")}

          <Text style={styles.sectionTitle}>Kogo szukasz?</Text>
          <Text style={styles.hint}>Wybierz do {collabMaxLooking}. Według tego dobieramy osoby w Collab.</Text>
          {picker("looking")}

          <Text style={styles.sectionTitle}>Twój projekt w jednym zdaniu</Text>
          <TextInput
            accessibilityLabel="Opis projektu"
            value={draft.pitch}
            onChangeText={(pitch) => setDraft((current) => ({ ...current, pitch: pitch.slice(0, collabPitchMaxLength) }))}
            placeholder="np. Szukam rapera do EP-ki, nagrywamy w Warszawie"
            placeholderTextColor={c.muted}
            maxLength={collabPitchMaxLength}
            multiline
            style={[styles.input, styles.inputMultiline]}
          />
          <Text style={styles.counter}>{draft.pitch.length}/{collabPitchMaxLength}</Text>

          <Text style={styles.sectionTitle}>Portfolio</Text>
          <Text style={styles.hint}>Jeden link, np. SoundCloud, Spotify, YouTube, Behance albo GitHub. Widoczny dopiero po matchu.</Text>
          <TextInput
            accessibilityLabel="Link do portfolio"
            value={draft.portfolio}
            onChangeText={(portfolio) => setDraft((current) => ({ ...current, portfolio }))}
            placeholder="https://"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            maxLength={collabPortfolioMaxLength}
            style={styles.input}
          />

          <View style={styles.switchRow}>
            <MaterialCommunityIcons name="earth" size={22} color={c.collab} />
            <View style={styles.fill}>
              <Text style={styles.switchTitle}>Współpraca zdalna</Text>
              <Text style={styles.hint}>Pokażemy Cię także osobom spoza Twojej okolicy.</Text>
            </View>
            <Switch accessibilityLabel="Współpraca zdalna" value={draft.remote} onValueChange={(remote) => setDraft((current) => ({ ...current, remote }))} trackColor={{ false: c.fillStronger, true: c.collab }} />
          </View>

          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

          {isCollabReady(value) && (
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void leave()} style={styles.leave}>
              <Text style={styles.leaveText}>Wyłącz Collab i ukryj mnie w tym trybie</Text>
            </Pressable>
          )}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.save, saving && styles.saveDisabled]}>
            {saving ? <ActivityIndicator color={c.onPrimary} /> : <MaterialCommunityIcons name="check" size={18} color={c.onPrimary} />}
            <Text style={styles.saveText}>Zapisz profil Collab</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.fillStrong },
    close: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: c.fillStrong },
    fill: { flex: 1 },
    eyebrow: { color: c.collab, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
    title: { color: c.ink, fontSize: 20, fontWeight: "900" },
    scroll: { gap: 10, padding: 16 },
    intro: { color: c.muted, fontSize: 14, lineHeight: 20 },
    sectionTitle: { marginTop: 14, color: c.ink, fontSize: 17, fontWeight: "800" },
    hint: { color: c.muted, fontSize: 13, lineHeight: 18 },
    block: { gap: 8 },
    counter: { alignSelf: "flex-end", color: c.muted, fontSize: 12, fontWeight: "700" },
    category: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: c.fill, borderWidth: 1, borderColor: c.fillStrong },
    categoryHeader: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
    categoryTitle: { flex: 1, color: c.ink, fontSize: 15, fontWeight: "700" },
    badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: c.collab },
    badgeText: { color: c.onPrimary, fontSize: 12, fontWeight: "900" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: c.surfaceStrong, borderWidth: 1, borderColor: c.fillStrong },
    chipActive: { backgroundColor: c.collab, borderColor: c.collab },
    chipDisabled: { opacity: 0.4 },
    chipText: { color: c.ink, fontSize: 14, fontWeight: "700" },
    chipTextActive: { color: c.onPrimary },
    input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, color: c.ink, backgroundColor: c.surfaceStrong, borderWidth: 1, borderColor: c.fillStronger, fontSize: 15 },
    inputMultiline: { minHeight: 84, textAlignVertical: "top" },
    switchRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.fill, borderWidth: 1, borderColor: c.fillStrong },
    switchTitle: { color: c.ink, fontSize: 15, fontWeight: "700" },
    error: { marginTop: 8, color: "#ff6b85", fontSize: 14, fontWeight: "700" },
    leave: { marginTop: 18, minHeight: 44, alignItems: "center", justifyContent: "center" },
    leaveText: { color: c.muted, fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
    footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.fillStrong },
    save: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, backgroundColor: c.collab },
    saveDisabled: { opacity: 0.6 },
    saveText: { color: c.onPrimary, fontSize: 16, fontWeight: "900" }
  });
}

const sheets = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };
