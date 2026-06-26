import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

const colors = {
  background: "#fbfbfd",
  surface: "rgba(255,255,255,0.78)",
  ink: "#1d1d1f",
  muted: "#86868b",
  primary: "#ff2d55",
  primaryDeep: "#ba0034",
  primarySoft: "#ffdada",
  line: "rgba(145,110,111,0.18)",
  green: "#34c759"
};

const profileImages = [
  require("./assets/profiles/profile-1.jpg"),
  require("./assets/profiles/profile-2.jpg"),
  require("./assets/profiles/profile-3.jpg"),
  require("./assets/profiles/profile-4.jpg"),
  require("./assets/profiles/profile-5.jpg"),
  require("./assets/profiles/profile-6.jpg")
];

type Tab = "discover" | "matches" | "messages" | "profile" | "safety";
type Mode = "classic" | "premium";

const profiles = {
  classic: {
    image: profileImages[0],
    name: "Aisha, 24",
    badge: "Zweryfikowana",
    tags: ["Kawa", "Indie pop", "2 km"],
    bio: "Projektantka, łowczyni ukrytych kawiarni i galerii. Szuka kogoś do rozmów bez pośpiechu."
  },
  premium: {
    image: profileImages[5],
    name: "Nika, 26",
    badge: "Premium match",
    tags: ["Sztuka", "Dziś online", "Superlike"],
    bio: "Kuratorka wystaw, fanka nocnych spacerów i dobrego matcha latte. Odpowiada szybko."
  }
};

function tap() {
  if (process.env.EXPO_OS === "ios") {
    Haptics.selectionAsync();
  }
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [onboarded, setOnboarded] = useState(false);
  const [intent, setIntent] = useState("Randki");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [tab, setTab] = useState<Tab>("discover");
  const [mode, setMode] = useState<Mode>("classic");
  const [pushEnabled, setPushEnabled] = useState(true);

  const isCompact = width < 380;
  const activeProfile = profiles[mode];

  const contentPadding = useMemo(
    () => ({
      paddingTop: onboarded ? Math.max(insets.top + 16, 28) : Math.max(insets.top + 34, 54),
      paddingBottom: onboarded ? insets.bottom + 108 : insets.bottom + 28,
      paddingHorizontal: isCompact ? 16 : 20
    }),
    [insets.bottom, insets.top, isCompact, onboarded]
  );

  if (!onboarded) {
    return (
      <LinearGradient colors={["#fbfbfd", "#fff5f7"]} style={styles.root}>
        <StatusBar style="dark" />
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.scroll, contentPadding]}>
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText} selectable>S</Text>
            </View>
            <Text style={styles.eyebrow} selectable>Cherry Blossom Connect</Text>
            <Text style={styles.title} selectable>Spark</Text>
            <Text style={styles.lead} selectable>
              Poznawaj ludzi blisko Ciebie: na randkę, kawę, koncert albo spokojny spacer po mieście.
            </Text>
          </View>

          <View style={styles.intentList}>
            {[
              ["Randki", "Chemia, rozmowy, spotkania", "♡"],
              ["Znajomi", "Kawa, planszówki, miasto", "✦"],
              ["Społeczność", "LGBT+, grupy, wydarzenia", "⌁"]
            ].map(([label, description, icon]) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                onPress={() => {
                  tap();
                  setIntent(label);
                }}
                style={[styles.intentCard, intent === label && styles.intentCardActive]}
              >
                <View style={styles.intentIcon}>
                  <Text style={styles.intentIconText}>{icon}</Text>
                </View>
                <View style={styles.fill}>
                  <Text style={styles.intentTitle} selectable>{label}</Text>
                  <Text style={styles.intentDescription} selectable>{description}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.noticeCard}>
            <View style={styles.fill}>
              <Text style={styles.noticeTitle} selectable>Potwierdzam 18+</Text>
              <Text style={styles.noticeText} selectable>
                Spark jest dla dorosłych. Akceptuję zasady społeczności: szacunek, zgłaszanie nadużyć i zero podszywania się.
              </Text>
            </View>
            <Switch value={ageConfirmed} onValueChange={setAgeConfirmed} trackColor={{ true: colors.green }} />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!ageConfirmed}
            onPress={() => {
              if (!ageConfirmed) {
                return;
              }
              tap();
              setOnboarded(true);
            }}
            style={[styles.primaryButton, !ageConfirmed && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>{ageConfirmed ? "Kontynuuj" : "Potwierdź 18+, aby kontynuować"}</Text>
          </Pressable>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#fbfbfd", "#fff4f7"]} style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.scroll, contentPadding]}>
        {tab === "discover" && (
          <View style={styles.gapLg}>
            <TopBar eyebrow="Odkrywaj" title="Spark" left="≡" right="⌘" />
            <View style={styles.segmented}>
              {(["classic", "premium"] as Mode[]).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    tap();
                    setMode(item);
                  }}
                  style={[styles.segmentButton, mode === item && styles.segmentButtonActive]}
                >
                  <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>
                    {item === "classic" ? "Klasycznie" : "Premium"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.profileCard}>
              <Image source={activeProfile.image} style={styles.profileImage} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.74)"]} style={styles.cardShade} />
              <View style={styles.badgeRow}>
                {activeProfile.tags.map((tag) => (
                  <Text key={tag} style={styles.badge} selectable>{tag}</Text>
                ))}
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.verified} selectable>{activeProfile.badge}</Text>
                <Text style={styles.cardTitle} selectable>{activeProfile.name}</Text>
                <Text style={styles.cardBio} selectable>{activeProfile.bio}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <RoundAction label="×" tone="light" />
              <RoundAction label="♡" tone="primary" large />
              <RoundAction label="+" tone="light" />
            </View>

            {mode === "premium" && (
              <View style={styles.premiumGrid}>
                {["Superlike", "Napisz", "Zapisz"].map((label) => (
                  <Pressable key={label} style={styles.premiumAction}>
                    <Text style={styles.premiumIcon}>{label === "Superlike" ? "✧" : label === "Napisz" ? "↗" : "⌘"}</Text>
                    <Text style={styles.premiumText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === "matches" && (
          <View style={styles.gapLg}>
            <TopBar eyebrow="Match" title="Nowe iskry" left="‹" right="⌕" />
            <View style={styles.matchGrid}>
              {[
                ["Lena, 27", "98% wspólne vibe", profileImages[1]],
                ["Kuba, 29", "Koncert dziś", profileImages[2]],
                ["Mia, 25", "2 km od Ciebie", profileImages[3]],
                ["Alex, 31", "Sztuka i design", profileImages[4]]
              ].map(([name, subtitle, image]) => (
                <View key={String(name)} style={styles.matchCard}>
                  <Image source={image} style={styles.matchImage} contentFit="cover" />
                  <Text style={styles.matchName} selectable>{name}</Text>
                  <Text style={styles.matchSubtitle} selectable>{subtitle}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {tab === "messages" && (
          <View style={styles.gapLg}>
            <TopBar eyebrow="Social" title="Wiadomości" left="≡" right="+" />
            <View style={styles.searchField}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput placeholder="Szukaj rozmów" placeholderTextColor={colors.muted} style={styles.searchInput} />
            </View>
            <View style={styles.chatList}>
              {[
                ["Zuzanna K.", "Hej! Idziemy dzisiaj na kawę?", "12:04", profileImages[1]],
                ["Michał R.", "Brzmi super, do zobaczenia później.", "Wczoraj", profileImages[2]],
                ["Kasia M.", "Prześlę Ci te zdjęcia wieczorem.", "Wtorek", profileImages[3]],
                ["Weekend Trip", "Jan: Kto bierze namiot?", "Pon.", profileImages[5]]
              ].map(([name, message, time, image]) => (
                <Pressable key={String(name)} style={styles.chatItem}>
                  <Image source={image} style={styles.chatAvatar} contentFit="cover" />
                  <View style={styles.fill}>
                    <Text style={styles.chatName} selectable>{name}</Text>
                    <Text style={styles.chatMessage} numberOfLines={1} selectable>{message}</Text>
                  </View>
                  <Text style={styles.chatTime} selectable>{time}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {tab === "safety" && <SafetyCenter onBack={() => setTab("profile")} />}

        {tab === "profile" && (
          <View style={styles.gapLg}>
            <View style={styles.profileHero}>
              <Image source={profileImages[4]} style={styles.profileHeroImage} contentFit="cover" />
              <Pressable style={styles.editButton}>
                <Text style={styles.editButtonText}>✎</Text>
              </Pressable>
            </View>
            <View style={styles.profilePanel}>
              <Text style={styles.eyebrow} selectable>Profil</Text>
              <Text style={styles.profileName} selectable>Alex Mercer</Text>
              <Text style={styles.profileDescription} selectable>
                Digital creator, fan estetyki sakury i spokojnych rozmów. Szukam ludzi do kawy, sztuki i spontanicznych mikroprzygód.
              </Text>
              <View style={styles.statsRow}>
                {[
                  ["126", "polubień"],
                  ["18", "matchy"],
                  ["4.9", "vibe"]
                ].map(([value, label]) => (
                  <View key={label} style={styles.statBox}>
                    <Text style={styles.statValue} selectable>{value}</Text>
                    <Text style={styles.statLabel} selectable>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.settingsList}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel} selectable>Powiadomienia push</Text>
                  <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ true: colors.green }} />
                </View>
                <SettingRow label="Centrum bezpieczeństwa" value="Otwórz" onPress={() => setTab("safety")} />
                <SettingRow label="Widoczność profilu" value="Publiczny" />
                <SettingRow label="Preferencje motywu" value="Sakura" />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <BlurView intensity={72} tint="light" style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {[
          ["discover", "Discover", "✦"],
          ["matches", "Match", "♡"],
          ["messages", "Social", "⌁"],
          ["profile", "Profile", "◦"]
        ].map(([key, label, icon]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => {
              tap();
              setTab(key as Tab);
            }}
            style={[styles.navButton, tab === key && styles.navButtonActive]}
          >
            <Text style={[styles.navIcon, tab === key && styles.navTextActive]}>{icon}</Text>
            <Text style={[styles.navText, tab === key && styles.navTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </BlurView>
    </LinearGradient>
  );
}

function SafetyCenter({ onBack }: { onBack: () => void }) {
  const actions = [
    ["Zgłoś profil", "Wyślij zgłoszenie do moderacji z ostatnim kontekstem rozmowy.", "Priorytet"],
    ["Zablokuj użytkownika", "Ukryj profil, przerwij match i zablokuj wiadomości.", "Natychmiast"],
    ["Zasady społeczności", "Szacunek, zgoda, prawdziwa tożsamość i brak nękania.", "Czytaj"],
    ["Prywatność i dane", "Zarządzaj widocznością, eksportem i usunięciem konta.", "Otwórz"]
  ];

  return (
    <View style={styles.gapLg}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.iconButton}>
          <Text style={styles.iconButtonText}>‹</Text>
        </Pressable>
        <View style={styles.fill}>
          <Text style={styles.eyebrow} selectable>Safety</Text>
          <Text style={styles.screenTitle} selectable>Centrum bezpieczeństwa</Text>
        </View>
        <IconButton label="?" />
      </View>

      <View style={styles.safetyHero}>
        <Text style={styles.safetyHeroIcon}>✦</Text>
        <Text style={styles.safetyHeroTitle} selectable>Bezpieczne poznawanie ludzi</Text>
        <Text style={styles.safetyHeroText} selectable>
          Każdy profil może zostać zgłoszony lub zablokowany. Te akcje powinny trafić do backendu moderacji przed publiczną premierą.
        </Text>
      </View>

      <View style={styles.safetyList}>
        {actions.map(([title, body, cta]) => (
          <Pressable key={title} style={styles.safetyAction}>
            <View style={styles.fill}>
              <Text style={styles.safetyActionTitle} selectable>{title}</Text>
              <Text style={styles.safetyActionText} selectable>{body}</Text>
            </View>
            <Text style={styles.safetyActionCta}>{cta}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.deleteCard}>
        <Text style={styles.deleteTitle} selectable>Usunięcie konta w aplikacji</Text>
        <Text style={styles.deleteText} selectable>
          App Store wymaga łatwej ścieżki usunięcia konta, jeśli aplikacja pozwala je tworzyć. Ten ekran rezerwuje miejsce na ten flow.
        </Text>
      </View>
    </View>
  );
}

function TopBar({ eyebrow, title, left, right }: { eyebrow: string; title: string; left: string; right: string }) {
  return (
    <View style={styles.topBar}>
      <IconButton label={left} />
      <View style={styles.fill}>
        <Text style={styles.eyebrow} selectable>{eyebrow}</Text>
        <Text style={styles.screenTitle} selectable>{title}</Text>
      </View>
      <IconButton label={right} />
    </View>
  );
}

function IconButton({ label }: { label: string }) {
  return (
    <Pressable accessibilityRole="button" style={styles.iconButton}>
      <Text style={styles.iconButtonText}>{label}</Text>
    </Pressable>
  );
}

function RoundAction({ label, tone, large = false }: { label: string; tone: "light" | "primary"; large?: boolean }) {
  return (
    <Pressable style={[styles.roundAction, large && styles.roundActionLarge, tone === "primary" && styles.roundActionPrimary]}>
      <Text style={[styles.roundActionText, tone === "primary" && styles.roundActionPrimaryText]}>{label}</Text>
    </Pressable>
  );
}

function SettingRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.settingRow} onPress={onPress}>
      <Text style={styles.settingLabel} selectable>{label}</Text>
      <Text style={styles.settingValue} selectable>{value}</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  scroll: {
    gap: 24
  },
  fill: {
    flex: 1
  },
  gapLg: {
    gap: 18
  },
  brand: {
    alignItems: "center",
    gap: 12,
    paddingTop: 18
  },
  logoMark: {
    width: 92,
    height: 92,
    borderRadius: 30,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    boxShadow: "0 22px 48px rgba(255,45,85,0.28)"
  },
  logoText: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "800"
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 60
  },
  lead: {
    maxWidth: 330,
    color: "#5d3f40",
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center"
  },
  intentList: {
    gap: 12
  },
  intentCard: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.64)",
    backgroundColor: "rgba(255,255,255,0.64)",
    boxShadow: "0 14px 34px rgba(99,51,61,0.07)"
  },
  intentCardActive: {
    borderColor: "rgba(255,45,85,0.32)",
    backgroundColor: "rgba(255,255,255,0.94)"
  },
  intentIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  intentIconText: {
    color: colors.primaryDeep,
    fontSize: 28,
    fontWeight: "700"
  },
  intentTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800"
  },
  intentDescription: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 14
  },
  noticeCard: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,45,85,0.14)"
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  noticeText: {
    marginTop: 4,
    color: "#5d3f40",
    fontSize: 13,
    lineHeight: 19
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    boxShadow: "0 16px 36px rgba(255,45,85,0.3)"
  },
  primaryButtonDisabled: {
    backgroundColor: "rgba(255,45,85,0.42)",
    boxShadow: "0 8px 20px rgba(255,45,85,0.14)"
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    boxShadow: "0 10px 24px rgba(99,51,61,0.08)"
  },
  iconButtonText: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "700"
  },
  screenTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0
  },
  segmented: {
    flexDirection: "row",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)"
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: "#fff",
    boxShadow: "0 8px 20px rgba(99,51,61,0.08)"
  },
  segmentText: {
    color: colors.muted,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: colors.primaryDeep
  },
  profileCard: {
    height: 560,
    overflow: "hidden",
    borderRadius: 34,
    borderCurve: "continuous",
    backgroundColor: "#eee",
    boxShadow: "0 26px 64px rgba(63,28,36,0.18)"
  },
  profileImage: {
    width: "100%",
    height: "100%"
  },
  cardShade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  },
  badgeRow: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    color: "#442129",
    backgroundColor: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: "900"
  },
  profileCopy: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 22
  },
  verified: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    color: "#fff",
    backgroundColor: colors.green,
    fontSize: 12,
    fontWeight: "900"
  },
  cardTitle: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 38
  },
  cardBio: {
    maxWidth: 330,
    marginTop: 8,
    color: "#fff",
    fontSize: 15,
    lineHeight: 22
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18
  },
  roundAction: {
    width: 74,
    height: 74,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.82)",
    boxShadow: "0 16px 34px rgba(99,51,61,0.12)"
  },
  roundActionLarge: {
    width: 92,
    height: 92
  },
  roundActionPrimary: {
    backgroundColor: colors.primary,
    boxShadow: "0 18px 40px rgba(255,45,85,0.35)"
  },
  roundActionText: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "700"
  },
  roundActionPrimaryText: {
    color: "#fff",
    fontSize: 42
  },
  premiumGrid: {
    flexDirection: "row",
    gap: 10
  },
  premiumAction: {
    flex: 1,
    minHeight: 70,
    borderRadius: 24,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,45,85,0.12)"
  },
  premiumIcon: {
    color: colors.primaryDeep,
    fontSize: 21,
    fontWeight: "800"
  },
  premiumText: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  matchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14
  },
  matchCard: {
    width: "48%",
    minHeight: 232,
    overflow: "hidden",
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: "#fff",
    boxShadow: "0 16px 34px rgba(99,51,61,0.08)"
  },
  matchImage: {
    width: "100%",
    height: 152
  },
  matchName: {
    paddingHorizontal: 14,
    paddingTop: 12,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  matchSubtitle: {
    paddingHorizontal: 14,
    paddingTop: 4,
    color: colors.muted,
    fontSize: 13
  },
  searchField: {
    minHeight: 52,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)"
  },
  searchIcon: {
    color: colors.muted,
    fontSize: 20
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 16
  },
  chatList: {
    gap: 10
  },
  chatItem: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: colors.surface
  },
  chatAvatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderCurve: "continuous"
  },
  chatName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  chatMessage: {
    maxWidth: 210,
    marginTop: 3,
    color: colors.muted,
    fontSize: 13
  },
  chatTime: {
    color: colors.muted,
    fontSize: 12
  },
  profileHero: {
    height: 340,
    overflow: "hidden",
    borderRadius: 34,
    borderCurve: "continuous"
  },
  profileHeroImage: {
    width: "100%",
    height: "100%"
  },
  editButton: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  editButtonText: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800"
  },
  profilePanel: {
    gap: 16
  },
  profileName: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0
  },
  profileDescription: {
    color: "#5d3f40",
    fontSize: 15,
    lineHeight: 23
  },
  statsRow: {
    flexDirection: "row",
    gap: 10
  },
  statBox: {
    flex: 1,
    minHeight: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: colors.surface
  },
  statValue: {
    color: colors.primaryDeep,
    fontSize: 22,
    fontWeight: "900",
    fontVariant: ["tabular-nums"]
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12
  },
  settingsList: {
    gap: 10
  },
  settingRow: {
    minHeight: 58,
    borderRadius: 22,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface
  },
  settingLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700"
  },
  settingValue: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: "900"
  },
  safetyHero: {
    minHeight: 190,
    gap: 10,
    padding: 22,
    borderRadius: 30,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    boxShadow: "0 18px 42px rgba(99,51,61,0.1)"
  },
  safetyHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    overflow: "hidden",
    textAlign: "center",
    textAlignVertical: "center",
    color: colors.primaryDeep,
    backgroundColor: colors.primarySoft,
    fontSize: 28,
    fontWeight: "900"
  },
  safetyHeroTitle: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
    letterSpacing: 0
  },
  safetyHeroText: {
    color: "#5d3f40",
    fontSize: 14,
    lineHeight: 21
  },
  safetyList: {
    gap: 10
  },
  safetyAction: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: colors.surface
  },
  safetyActionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  safetyActionText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  safetyActionCta: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  deleteCard: {
    gap: 6,
    padding: 18,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,218,218,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,45,85,0.14)"
  },
  deleteTitle: {
    color: colors.primaryDeep,
    fontSize: 16,
    fontWeight: "900"
  },
  deleteText: {
    color: "#5d3f40",
    fontSize: 13,
    lineHeight: 19
  },
  bottomNav: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 10,
    minHeight: 72,
    flexDirection: "row",
    gap: 4,
    padding: 8,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)"
  },
  navButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  navButtonActive: {
    backgroundColor: "rgba(255,218,218,0.72)"
  },
  navIcon: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "900"
  },
  navText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900"
  },
  navTextActive: {
    color: colors.primary
  }
});
