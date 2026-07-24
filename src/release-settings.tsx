import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { loadNotificationPreferences, listModerationReports, resolveModerationReport, saveNotificationPreferences, type ModerationReport } from "./firestore";
import { defaultNotificationPreferences, type NotificationPreferences } from "./notification-preferences";
import { setActiveNotificationPreferences } from "./notifications";
import { recordSparkError, trackSparkEvent } from "./telemetry";

const palette = {
  background: "#08060a",
  surface: "#15131a",
  surfaceSoft: "#201721",
  text: "#fff8fc",
  muted: "#aaa0aa",
  primary: "#ff2d8d",
  line: "rgba(255,45,141,0.24)",
  danger: "#ff668f"
};

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{subtitle}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Zamknij" onPress={onClose} style={styles.close}>
        <MaterialCommunityIcons name="close" size={23} color={palette.text} />
      </Pressable>
    </View>
  );
}

const notificationRows: Array<{ key: keyof Pick<NotificationPreferences, "messages" | "matches" | "requests" | "events" | "sound">; title: string; hint: string; icon: string }> = [
  { key: "messages", title: "Wiadomości", hint: "Nowe wiadomości w aktywnych rozmowach", icon: "message-text-outline" },
  { key: "matches", title: "Matche", hint: "Nowe wzajemne dopasowania", icon: "heart-multiple-outline" },
  { key: "requests", title: "Prośby", hint: "Prośby o rozmowę i ich akceptacje", icon: "email-heart-outline" },
  { key: "events", title: "Event Friends", hint: "Nowe wydarzenia dodane przez Spark", icon: "calendar-heart" },
  { key: "sound", title: "Dźwięk", hint: "Dźwięk dla dozwolonych powiadomień", icon: "volume-high" }
];

const quietPresets = [
  { start: "22:00", end: "08:00", label: "22:00–08:00" },
  { start: "23:00", end: "07:00", label: "23:00–07:00" },
  { start: "00:00", end: "08:00", label: "00:00–08:00" }
];

export function NotificationPreferencesModal({ visible, uid, onClose }: { visible: boolean; uid: string; onClose: () => void }) {
  const [draft, setDraft] = useState(defaultNotificationPreferences);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !uid) return;
    let active = true;
    setLoading(true);
    void loadNotificationPreferences(uid)
      .then((value) => {
        if (active) setDraft(value);
      })
      .catch((error) => {
        recordSparkError(error, "notification_preferences_load");
        Alert.alert("Powiadomienia", "Nie udało się pobrać ustawień.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [uid, visible]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveNotificationPreferences(uid, draft);
      setActiveNotificationPreferences(saved);
      trackSparkEvent("notification_preferences_saved", {
        quiet_hours: saved.quietHoursEnabled,
        enabled_categories: [saved.messages, saved.matches, saved.requests, saved.events].filter(Boolean).length
      });
      onClose();
    } catch (error) {
      recordSparkError(error, "notification_preferences_save");
      Alert.alert("Powiadomienia", error instanceof Error ? error.message : "Nie udało się zapisać ustawień.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <ModalHeader title="Powiadomienia" subtitle="TY DECYDUJESZ" onClose={onClose} />
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>Wybierz, kiedy Spark może zwrócić Twoją uwagę. Zmiany obowiązują na wszystkich zarejestrowanych urządzeniach.</Text>
            <View style={styles.card}>
              {notificationRows.map((row) => (
                <View key={row.key} style={styles.row}>
                  <View style={styles.rowIcon}><MaterialCommunityIcons name={row.icon as never} size={20} color={palette.primary} /></View>
                  <View style={styles.rowCopy}><Text style={styles.rowTitle}>{row.title}</Text><Text style={styles.rowHint}>{row.hint}</Text></View>
                  <Switch
                    value={draft[row.key]}
                    onValueChange={(value) => setDraft((current) => ({ ...current, [row.key]: value }))}
                    trackColor={{ false: "#45414a", true: palette.primary }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowIcon}><MaterialCommunityIcons name="weather-night" size={20} color={palette.primary} /></View>
                <View style={styles.rowCopy}><Text style={styles.rowTitle}>Cisza nocna</Text><Text style={styles.rowHint}>Powiadomienia zostaną dostarczone bez przerywania odpoczynku.</Text></View>
                <Switch
                  value={draft.quietHoursEnabled}
                  onValueChange={(value) => setDraft((current) => ({ ...current, quietHoursEnabled: value }))}
                  trackColor={{ false: "#45414a", true: palette.primary }}
                  thumbColor="#fff"
                />
              </View>
              {draft.quietHoursEnabled && (
                <View style={styles.presetRow}>
                  {quietPresets.map((preset) => {
                    const selected = draft.quietStart === preset.start && draft.quietEnd === preset.end;
                    return (
                      <Pressable key={preset.label} onPress={() => setDraft((current) => ({ ...current, quietStart: preset.start, quietEnd: preset.end }))} style={[styles.preset, selected && styles.presetSelected]}>
                        <Text style={[styles.presetText, selected && styles.presetTextSelected]}>{preset.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        )}
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" disabled={saving || loading} onPress={() => void save()} style={[styles.primaryButton, (saving || loading) && styles.disabled]}>
            {saving ? <ActivityIndicator color="#fff" /> : <><MaterialCommunityIcons name="check" size={20} color="#fff" /><Text style={styles.primaryButtonText}>Zapisz ustawienia</Text></>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function ModerationQueueModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    void listModerationReports()
      .then(setReports)
      .catch((error) => {
        recordSparkError(error, "moderation_queue_load");
        Alert.alert("Moderacja", error instanceof Error ? error.message : "Nie udało się pobrać zgłoszeń.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (visible) refresh();
  }, [visible]);

  const resolve = (report: ModerationReport, action: "dismiss" | "warn" | "suspend") => {
    const execute = async () => {
      setBusyId(report.id);
      try {
        await resolveModerationReport(report.id, action);
        setReports((current) => current.map((item) => item.id === report.id ? { ...item, status: action === "dismiss" ? "dismissed" : action === "warn" ? "warned" : "suspended" } : item));
        trackSparkEvent("moderation_report_resolved", { action });
      } catch (error) {
        recordSparkError(error, "moderation_report_resolve", { action });
        Alert.alert("Moderacja", error instanceof Error ? error.message : "Nie udało się zapisać decyzji.");
      } finally {
        setBusyId(null);
      }
    };
    if (action === "suspend") {
      Alert.alert("Zawiesić konto?", "Profil zostanie natychmiast ukryty, a konto straci możliwość korzystania z aplikacji.", [
        { text: "Anuluj", style: "cancel" },
        { text: "Zawieś", style: "destructive", onPress: () => void execute() }
      ]);
    } else {
      void execute();
    }
  };

  const openReports = reports.filter((report) => report.status === "open");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <ModalHeader title="Kolejka zgłoszeń" subtitle="MODERACJA SPARK" onClose={onClose} />
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.queueSummary}><Text style={styles.queueCount}>{openReports.length}</Text><View><Text style={styles.rowTitle}>otwartych zgłoszeń</Text><Text style={styles.rowHint}>Najpierw sprawdzaj groźby, nękanie i podszywanie się.</Text></View></View>
            {openReports.length === 0 ? (
              <View style={styles.empty}><MaterialCommunityIcons name="shield-check" size={34} color="#42d982" /><Text style={styles.emptyTitle}>Kolejka jest pusta</Text><Text style={styles.rowHint}>Wszystkie zgłoszenia zostały obsłużone.</Text></View>
            ) : openReports.map((report) => (
              <View key={report.id} style={styles.report}>
                <View style={styles.reportTop}><Text style={styles.reportReason}>{report.reason}</Text><Text style={styles.reportDate}>{report.createdAtMs ? new Date(report.createdAtMs).toLocaleDateString("pl-PL") : "teraz"}</Text></View>
                <Text style={styles.reportId}>Profil: {report.targetUid}</Text>
                {report.context ? <Text style={styles.reportContext} numberOfLines={4}>{report.context}</Text> : null}
                <View style={styles.reportActions}>
                  <Pressable disabled={busyId === report.id} onPress={() => resolve(report, "dismiss")} style={styles.reportAction}><Text style={styles.reportActionText}>Odrzuć</Text></Pressable>
                  <Pressable disabled={busyId === report.id} onPress={() => resolve(report, "warn")} style={styles.reportAction}><Text style={styles.reportActionText}>Ostrzeż</Text></Pressable>
                  <Pressable disabled={busyId === report.id} onPress={() => resolve(report, "suspend")} style={[styles.reportAction, styles.reportDanger]}><Text style={styles.reportDangerText}>Zawieś</Text></Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  header: { paddingTop: 28, paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: palette.line },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: palette.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 28, fontWeight: "900" },
  close: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 16, paddingBottom: 120 },
  intro: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, overflow: "hidden" },
  row: { minHeight: 76, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)" },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,45,141,0.12)" },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: palette.text, fontSize: 15, fontWeight: "800" },
  rowHint: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  presetRow: { padding: 12, flexDirection: "row", gap: 8 },
  preset: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  presetSelected: { borderColor: palette.primary, backgroundColor: "rgba(255,45,141,0.16)" },
  presetText: { color: palette.muted, fontSize: 11, fontWeight: "800" },
  presetTextSelected: { color: palette.text },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: "rgba(8,6,10,0.96)", borderTopWidth: 1, borderTopColor: palette.line },
  primaryButton: { minHeight: 58, borderRadius: 18, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  queueSummary: { padding: 18, borderRadius: 18, backgroundColor: palette.surfaceSoft, flexDirection: "row", alignItems: "center", gap: 14 },
  queueCount: { color: palette.primary, fontSize: 36, fontWeight: "900" },
  empty: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 18, backgroundColor: palette.surface },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: "900" },
  report: { padding: 16, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  reportTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  reportReason: { flex: 1, color: palette.text, fontSize: 16, fontWeight: "900" },
  reportDate: { color: palette.muted, fontSize: 11 },
  reportId: { color: palette.primary, fontSize: 11, fontWeight: "800" },
  reportContext: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  reportActions: { flexDirection: "row", gap: 8 },
  reportAction: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  reportActionText: { color: palette.text, fontSize: 12, fontWeight: "800" },
  reportDanger: { backgroundColor: "rgba(255,102,143,0.15)" },
  reportDangerText: { color: palette.danger, fontSize: 12, fontWeight: "900" }
});