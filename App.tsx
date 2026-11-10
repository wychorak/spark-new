import { EventDateField, EventCityField } from "./src/events/EventFields";
import { searchKey, validateEventFields } from "./src/events/event-form-model";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { BlurView } from "expo-blur";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share as NativeShare,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View
} from "react-native";
import { Text, TextInput } from "./src/i18n/Text";
import { captureRef } from "react-native-view-shot";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { currentUserUsesAppleSignIn, ensureRecentLoginForAccountDeletion, getRevenueCatEntitlements, observeAuthState, reauthenticateAndRevokeApple, requestPasswordReset, signInWithAppleIdToken, signInWithEmail, signInWithGoogleIdToken, signOutUser, signUpWithEmail, type AppAuthUser } from "./src/auth";
import { firebaseConfigStatus, isFirebaseConfigured } from "./src/firebase";
import { isSparkOwnerAccount } from "./src/access";
import { findModerationViolation } from "./src/content-moderation";
import {
  acceptChatRequest,
  blockUser,
  cancelChatRequest,
  cancelProfileLike,
  createMatchThread,
  createPremiumChatRequest,
  createReport,
  findIncomingProfileLikes,
  findMatchThreadsForUser,
  findOutgoingProfileSwipes,
  findProfilesByActiveEvents,
  findProfilesByInterest,
  findTestProfiles,
  getMonthlySuperlikeUsage,
  getPublicProfile,
  getPublicProfiles,
  getUserProfile,
  getUserPrivateSettings,
  hasIncomingProfileLike,
  markChatThreadRead,
  observeBlockedProfileKeys,
  observeChatMessages,
  observeModerationStatus,
  observeVerificationStatus,
  observeRecentProfileViews,
  observeSparkEvents,
  observeUserChats,
  prepareReviewDemo,
  publishSparkEvent,
  listMyEventProposals,
  listPendingEventProposals,
  reviewEventProposal,
  submitEventProposal,
  withdrawEventProposal,
  type EventDetails,
  type EventProposal,
  recordCurrentUserProfileView,
  recordProfileSwipe,
  recordUserLogin,
  rejectChatRequest,
  removeSparkEvent,
  requestAccountDeletionAndDeleteProfile,
  resetPassedProfiles,
  sendChatMessage,
  sendSparkLike,
  syncProfileVerification,
  syncPublicUserProfile,
  unblockUser,
  updateUserActiveEvents,
  updateUserDiscoveryPreferences,
  updateUserDiscoveryLens,
  updateUserLgbt,
  getLgbtCommunityTags,
  type LgbtSettings,
  upsertUserProfile,
  upsertUserPrivateSettings,
  updateDeviceLanguage,
  type DiscoveryCursor,
  type ProfileVerificationStatus
} from "./src/firestore";
import {
  eventCategories,
  eventIconOptions,
  formatEventDate,
  formatEventDateRange,
  getEventCategoryDefaultIcon,
  formatEventDateTimeInput,
  getDefaultEventDateTimes,
  getSharedActiveEvents,
  isEventActive,
  maxSelectedEvents,
  normalizeSparkEvent,
  parseEventDateTimeInput,
  sanitizeActiveEvents,
  type EventCategoryId,
  type EventIconId,
  type SparkEvent
} from "./src/events";
import { googleClientIds, isGoogleSignInConfigured } from "./src/google-sign-in";
import { openAdsPrivacyOptions, SparkAdBanner, useGoogleMobileAds, useSwipeInterstitialAds } from "./src/ads";
import { hasSparknewPro, revenueCatEntitlementId, useRevenueCat, type RevenueCatState, type SparkPlanId } from "./src/revenuecat";
import { deleteProfilePhotos, uploadProfilePhotos } from "./src/profile-storage";
import { getInitialSparkNotificationRoute, observeSparkNotificationResponses, registerSparkPushNotifications, setSparkAppBadgeCount } from "./src/notifications";
import { registerPositiveMatchForReview } from "./src/store-review";
import { ModerationQueueModal, NotificationPreferencesModal } from "./src/release-settings";
import { ThemeProvider, palettes, useThemeState, type Palette } from "./src/theme";
import { LgbtSettingsPanel } from "./src/LgbtSettings";
import { languageOptions, setLanguage, useLanguage } from "./src/i18n";
import { distanceLimitLabel, formatDate, formatDistance, formatHeight, formatTime, getDeviceCountryCode, usesImperialDistance } from "./src/i18n/region";
import { DeckBackdrop, DeckCard, DiscoverHeader, GlassActionBar, GlassSurface, ModeBadge, ModeFilter, ModeSwitch, type ActionItem, type DeckCardData, type DiscoverMode as DeckMode } from "./src/discover/DiscoverParts";
import {
  defaultSparkReleaseConfig,
  identifyTelemetryUser,
  initializeSparkTelemetry,
  recordSparkError,
  trackSparkEvent,
  trackSparkScreen,
  type SparkReleaseConfig
} from "./src/telemetry";



const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || "sparkapp@gmail.com";
const appInstallUrl = process.env.EXPO_PUBLIC_APP_INSTALL_URL || "https://apps.apple.com/app/id6785284685";
const legalLinks = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || "https://spark-new-legal.vercel.app/privacy",
  terms: process.env.EXPO_PUBLIC_TERMS_URL || "https://spark-new-legal.vercel.app/terms",
  community: process.env.EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL || "https://spark-new-legal.vercel.app/community-guidelines"
};
const showDemoLogin = __DEV__ && process.env.EXPO_PUBLIC_SHOW_DEMO_LOGIN === "true";
// Owner + the App Review demo account always see test profiles, so a
// reviewer never lands on an empty feed; the env list can add more testers.
const builtInTestProfileViewerEmails = ["wychor234@gmail.com", "agnessa79@o2.pl", "ilovekanye797979@gmail.com"];
const configuredTestProfileViewerEmails = Array.from(new Set([
  ...builtInTestProfileViewerEmails,
  ...(process.env.EXPO_PUBLIC_TEST_PROFILE_VIEWER_EMAILS || "").split(",")
].map((value: string) => value.trim().toLowerCase()).filter(Boolean)));
const sparkEventAdminEmail = "wychor234@gmail.com";

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(Math.max(0, count));
}

function formatUnreadLabel(count: number) {
  if (count === 1) return "1 nieprzeczytana wiadomo\u015b\u0107";
  const lastTwo = count % 100;
  const last = count % 10;
  const noun = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "nieprzeczytane wiadomo\u015bci" : "nieprzeczytanych wiadomo\u015bci";
  return String(count) + " " + noun;
}

function openSupportEmail(subject = "Spark - pomoc") {
  const mailto = "mailto:" + supportEmail + "?subject=" + encodeURIComponent(subject);
  Linking.openURL(mailto).catch(() => {
    Alert.alert("Pomoc", "Napisz do nas: " + supportEmail);
  });
}

async function shareSparkInvite() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await NativeShare.share({
      title: "Dołącz do mnie w Spark",
      message: `Poznajmy nowych ludzi przez wspólne zainteresowania w Spark. Pobierz aplikację: ${appInstallUrl}`
    });
  } catch {
    Alert.alert("Zaproszenie", "Nie udało się otworzyć udostępniania. Spróbuj ponownie.");
  }
}

function openLegalDocument(title: string, url: string, envName: string) {
  if (!url) {
    Alert.alert(title, `Dokument jest chwilowo niedostępny. Kontakt: ${supportEmail}`);
    return;
  }

  WebBrowser.openBrowserAsync(url).catch(() => {
    Alert.alert(title, `Nie można otworzyć dokumentu. Kontakt: ${supportEmail}`);
  });
}
const brandLogoImage = require("./assets/photologo.png");
const headerLogoImage = require("./assets/spark-logo.png");
const loginLogoImage = require("./assets/loginpagelogo.png");

const profileImages = [
  require("./assets/profiles/profile-1.jpg"),
  require("./assets/profiles/profile-2.jpg"),
  require("./assets/profiles/profile-3.jpg"),
  require("./assets/profiles/profile-4.jpg"),
  require("./assets/profiles/profile-5.jpg"),
  require("./assets/profiles/profile-6.jpg")
];

const testerFeedImages = [
  require("./assets/profiles/tester-1.jpg"),
  require("./assets/profiles/tester-2.jpg"),
  require("./assets/profiles/tester-3.jpg")
];

const bundledTestProfileImages: Record<string, any> = {
  spark_test_kuba: testerFeedImages[0],
  spark_test_maja: testerFeedImages[1],
  spark_test_alex: testerFeedImages[2]
};

// Test profiles are only shown to tester accounts; these values win over the seeded documents
// so the photo, name and gender always match.
const bundledTestProfileOverrides: Record<string, { name: string; gender: ProfileGender }> = {
  spark_test_kuba: { name: "Wiktoria", gender: "woman" },
  spark_test_maja: { name: "Maja", gender: "woman" },
  spark_test_alex: { name: "Nela", gender: "woman" }
};

const bundledTestProfileIntents: Record<string, SparkIntent[]> = {
  spark_test_kuba: ["Randki", "Znajomi"],
  spark_test_maja: ["Randki", "Znajomi"],
  spark_test_alex: ["Randki", "Znajomi"]
};

const demoAccount = {
  email: "tester@spark.app",
  password: "sparkdemo",
  firstName: "Tester",
  lastName: "Spark"
};

function getSocialIcon(label: string): { family: SocialIconFamily; name: string; color: string; backgroundColor: string } {
  const normalized = label.toLowerCase();

  if (normalized.includes("instagram") || normalized === "ig") {
    return { family: "fontAwesome", name: "instagram", color: "#ff4fa3", backgroundColor: "rgba(255,79,163,0.16)" };
  }

  if (normalized.includes("tiktok")) {
    return { family: "fontAwesome5", name: "tiktok", color: "#f4f6ff", backgroundColor: "rgba(244,246,255,0.13)" };
  }

  if (normalized.includes("facebook") || normalized === "fb") {
    return { family: "fontAwesome", name: "facebook-square", color: "#1877f2", backgroundColor: "rgba(24,119,242,0.16)" };
  }

  if (normalized.includes("spotify") || normalized.includes("muzyka") || normalized.includes("music")) {
    return { family: "fontAwesome", name: "spotify", color: "#1ed760", backgroundColor: "rgba(30,215,96,0.15)" };
  }

  return { family: "material", name: "link-variant", color: "#ff69ad", backgroundColor: "rgba(255,45,141,0.18)" };
}

function SocialIcon({ label, size = 14 }: { label: string; size?: number }) {
  const icon = getSocialIcon(label);

  if (icon.family === "fontAwesome") {
    return <FontAwesome name={icon.name as any} size={size} color={icon.color} />;
  }

  if (icon.family === "fontAwesome5") {
    return <FontAwesome5 name={icon.name as any} size={size} color={icon.color} />;
  }

  return <MaterialCommunityIcons name={icon.name as any} size={size + 1} color={icon.color} />;
}

type SocialHandles = { instagram: string; tiktok: string; facebook: string };
const emptySocialHandles: SocialHandles = { instagram: "", tiktok: "", facebook: "" };

function normalizeSocialHandle(value: string) {
  let normalized = value.trim().replace(/\s+/g, "");
  normalized = normalized.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const pathParts = normalized.split("/").filter(Boolean);
  normalized = pathParts.length > 1 ? pathParts[pathParts.length - 1] : normalized;
  normalized = normalized.split(/[?#]/)[0].replace(/^@+/, "");
  return normalized.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 40);
}

function getSocialHandles(record: unknown): SocialHandles {
  const source = typeof record === "object" && record !== null ? record as Record<string, unknown> : {};
  const read = (platform: keyof SocialHandles) => {
    const entry = Object.entries(source).find(([label]) => label.toLowerCase().includes(platform));
    return typeof entry?.[1] === "string" ? normalizeSocialHandle(entry[1]) : "";
  };
  return { instagram: read("instagram"), tiktok: read("tiktok"), facebook: read("facebook") };
}

function socialHandlesToRecord(handles: SocialHandles) {
  return Object.fromEntries(
    ([
      ["Instagram", handles.instagram],
      ["TikTok", handles.tiktok],
      ["Facebook", handles.facebook]
    ] as const)
      .map(([label, value]) => [label, normalizeSocialHandle(value)] as const)
      .filter(([, value]) => value.length > 0)
  );
}

function socialHandlesToProfileSocials(handles: SocialHandles) {
  return Object.entries(socialHandlesToRecord(handles)).map(([label, value]) => ({ label, value }));
}

function formatSocialHandle(value: string) {
  const normalized = normalizeSocialHandle(value);
  return normalized ? "@" + normalized : "";
}

type Tab = "discover" | "matches" | "messages" | "premium" | "profile" | "safety";
type DiscoverMode = "people" | "events";
type PremiumEntrySource = "navigation" | "spark_like" | "chat_request" | "profile_views" | "photos";
type SparkIntent = "Randki" | "Znajomi" | "LGBT+ / Społeczność";
const sparkIntentOptions: ReadonlyArray<{ label: SparkIntent; displayLabel: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; rainbow?: boolean }> = [
  { label: "Randki", displayLabel: "Randki", icon: "heart-outline" },
  { label: "Znajomi", displayLabel: "Znajomi", icon: "coffee-outline" },
  { label: "LGBT+ / Społeczność", displayLabel: "LGBT+", icon: "account-group-outline", rainbow: true }
];
const sparkIntentLabels = sparkIntentOptions.map((option) => option.label);

function normalizeSparkIntents(value: unknown, legacyIntent?: unknown): SparkIntent[] {
  const values = Array.isArray(value) ? value : legacyIntent ? [legacyIntent] : [];
  const normalized = values
    .filter((item): item is string => typeof item === "string")
    .map((item) => repairLegacyText(item.trim()))
    .filter((item): item is SparkIntent => sparkIntentLabels.includes(item as SparkIntent));
  return Array.from(new Set(normalized)).slice(0, 3) as SparkIntent[];
}

/** People feed lens chosen with the big Romantic / Friends / Event switch. */
type PeopleLens = "romantic" | "friends";
function lensFromIntents(target: SparkIntent[], own: SparkIntent[]): PeopleLens {
  if (target.includes("Randki") && !target.includes("Znajomi")) return "romantic";
  if (target.includes("Znajomi") && !target.includes("Randki")) return "friends";
  return own.includes("Randki") || own.length === 0 ? "romantic" : "friends";
}
function lensIntentsFor(lens: PeopleLens): SparkIntent[] {
  return lens === "romantic" ? ["Randki"] : ["Znajomi", "LGBT+ / Społeczność"];
}

function getProfileIntents(profile: Pick<MatchProfile, "intents" | "intent">) {
  return normalizeSparkIntents(profile.intents, profile.intent);
}

/** Mode a match or like belongs to. Older matches have no modeContext, so
 *  fall back to the shared event, then to both people's goals. */
function relationMode(thread: Pick<ChatThread, "modeContext" | "eventContext"> | undefined, profile: Pick<MatchProfile, "intents" | "intent">, own: SparkIntent[]): DeckMode {
  if (thread?.modeContext) return thread.modeContext;
  if (thread?.eventContext) return "event";
  return getProfileIntents(profile).includes("Randki") && (own.length === 0 || own.includes("Randki")) ? "romantic" : "friends";
}

function countByMode(modes: DeckMode[]): Record<DeckMode | "all", number> {
  return {
    all: modes.length,
    romantic: modes.filter((mode) => mode === "romantic").length,
    friends: modes.filter((mode) => mode === "friends").length,
    event: modes.filter((mode) => mode === "event").length
  };
}

type ProfileGender = "woman" | "man" | "nonbinary" | "unspecified";
type DiscoverableGender = Exclude<ProfileGender, "unspecified">;
type IntentPreferenceKey = "dating" | "friends" | "community";
type GenderPreferencesByIntent = Record<IntentPreferenceKey, DiscoverableGender[]>;

const discoverableGenders: DiscoverableGender[] = ["woman", "man", "nonbinary"];
const genderOptions: ReadonlyArray<{ value: ProfileGender; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { value: "woman", label: "Kobieta", icon: "gender-female" },
  { value: "man", label: "Mężczyzna", icon: "gender-male" },
  { value: "nonbinary", label: "Osoba niebinarna", icon: "gender-non-binary" },
  { value: "unspecified", label: "Wolę nie podawać", icon: "account-question-outline" }
];

function getIntentPreferenceKey(intent: SparkIntent): IntentPreferenceKey {
  if (intent === "Randki") return "dating";
  if (intent === "Znajomi") return "friends";
  return "community";
}

function createDefaultGenderPreferences(): GenderPreferencesByIntent {
  return {
    dating: [...discoverableGenders],
    friends: [...discoverableGenders],
    community: [...discoverableGenders]
  };
}

function normalizeProfileGender(value: unknown): ProfileGender {
  return value === "woman" || value === "man" || value === "nonbinary" || value === "unspecified" ? value : "unspecified";
}

function normalizeDesiredGenders(value: unknown): DiscoverableGender[] {
  if (!Array.isArray(value)) return [...discoverableGenders];
  const normalized = Array.from(new Set(value.filter((item): item is DiscoverableGender => discoverableGenders.includes(item as DiscoverableGender))));
  return normalized.length > 0 ? normalized : [...discoverableGenders];
}

function normalizeGenderPreferences(value: unknown): GenderPreferencesByIntent {
  const source = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    dating: normalizeDesiredGenders(source.dating),
    friends: normalizeDesiredGenders(source.friends),
    community: normalizeDesiredGenders(source.community)
  };
}

function genderPreferenceMatches(profile: MatchProfile, viewerGender: ProfileGender, preferences: GenderPreferencesByIntent, targetIntents: SparkIntent[]) {
  const candidateGender = profile.gender ?? "unspecified";
  const relevantIntents = getProfileIntents(profile).filter((intent) => targetIntents.length === 0 || targetIntents.includes(intent));
  if (relevantIntents.length === 0) return targetIntents.length === 0;
  return relevantIntents.some((intent) => {
    const key = getIntentPreferenceKey(intent);
    const viewerAllowsCandidate = candidateGender === "unspecified"
      ? preferences[key].length === discoverableGenders.length
      : preferences[key].includes(candidateGender);
    const candidatePreferences = profile.desiredGendersByIntent;
    const candidateAllowsViewer = viewerGender === "unspecified" || !candidatePreferences || candidatePreferences[key].includes(viewerGender);
    return viewerAllowsCandidate && candidateAllowsViewer;
  });
}

type DiscoverFilters = { lgbtOnly: boolean; proOnly: boolean; requireCommonInterests: boolean; includeProfilesWithoutLocation: boolean; targetInterests: string[]; targetIntents: SparkIntent[]; targetGendersByIntent: GenderPreferencesByIntent; maxDistanceKm: number; ageMin: number; ageMax: number };
const createDefaultDiscoverFilters = (): DiscoverFilters => ({ lgbtOnly: false, proOnly: false, requireCommonInterests: false, includeProfilesWithoutLocation: true, targetInterests: [], targetIntents: [], targetGendersByIntent: createDefaultGenderPreferences(), maxDistanceKm: 100, ageMin: 18, ageMax: 35 });
type AuthMode = "login" | "register";
type SwipeAction = "pass" | "like" | "superlike";
type SwipeOutcome = "passed" | "liked" | "matched" | "cancelled";
type AgeBand = "18+" | null;
type ProfilePhoto = number | string;
type ProfileNameMode = "realName" | "nickname";
type ChatStatus = "matched" | "requested" | "blocked";
type SocialIconFamily = "fontAwesome" | "fontAwesome5" | "material";

type ChatThread = {
  profileKey: string;
  threadId?: string;
  createdByUid?: string;
  createdAtMs?: number | null;
  requestDirection?: "incoming" | "outgoing";
  status: ChatStatus;
  introMessage?: string;
  lastMessageText?: string;
  lastMessageAtMs?: number | null;
  eventContext?: SparkEvent;
  modeContext?: DeckMode;
  unreadCount?: number;
  messages: Array<{ id: string; from: "me" | "them"; text: string; time: string }>;
};

type MatchProfile = {
  id: string;
  name: string;
  surname: string;
  age: number;
  city: string;
  country?: string;
  bio: string;
  distance: string;
  latitude: number;
  longitude: number;
  locationAvailable?: boolean;
  image: any;
  photos?: any[];
  interests: string[];
  activeEvents?: SparkEvent[];
  sharedEvents?: SparkEvent[];
  lgbtTag?: string[] | null;
  featuredInterests?: string[];
  socials: { label: string; value: string }[];
  premium?: boolean;
  verified?: boolean;
  likedYou?: boolean;
  isTestProfile?: boolean;
  desiredAgeMin?: number;
  desiredAgeMax?: number;
  heightCm?: number;
  weightKg?: number;
  matchScore?: number;
  compatibilityScore?: number;
  interestMatchPercent?: number;
  matchReasons?: string[];
  recommendationTier?: number;
  profileViewCount?: number;
  profileLastViewedAtMs?: number | null;
  intent?: string;
  intents?: SparkIntent[];
  gender?: ProfileGender;
  desiredGendersByIntent?: GenderPreferencesByIntent;
  updatedAtMs?: number;
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

const interestCategories = [
  { title: "Popularne", icon: "heart", items: ["Filmy", "Natura", "Muzyka", "Kawa", "Sport", "Sztuka", "Podróże", "Gaming", "Książki", "Kuchnia", "Fotografia", "Tech", "Joga", "Koncerty", "Planszówki", "LGBT+"] },
  { title: "Lifestyle", icon: "creation", items: ["Moda", "Streetwear", "Siłownia", "Bieganie", "Zdrowe jedzenie", "Gotowanie", "Kawiarnie", "Nocne spacery", "Tatuaże", "Samorozwój", "Minimalizm", "Anime"] },
  { title: "Sport i ruch", icon: "run", items: ["Piłka nożna", "Koszykówka", "Tenis", "Rower", "Taniec", "Pilates", "Wspinaczka", "Góry", "Basen", "Sztuki walki", "Skate", "Snowboard"] },
  { title: "Kultura", icon: "palette", items: ["Teatr", "Muzea", "Design", "Architektura", "Kino studyjne", "Seriale", "Podcasty", "Poezja", "Manga", "Komiksy", "Psychologia", "Historia"] },
  { title: "Tech i gry", icon: "controller", items: ["AI", "Startupy", "Programowanie", "UX/UI", "Crypto", "Minecraft", "Valorant", "League of Legends", "Counter-Strike", "Fortnite", "Nintendo", "PlayStation"] },
  { title: "Rap PL", icon: "microphone-variant", items: ["Taco Hemingway", "Mata", "Quebonafide", "Bedoes", "PRO8L3M", "OKI", "Young Leosia", "White 2115", "Białas", "Sobel", "Otsochodzi", "Kizo", "Kaz Bałagane", "Chivas"] },
  { title: "Rap / Pop świat", icon: "music-circle", items: ["Playboi Carti", "Travis Scott", "Drake", "Kendrick Lamar", "The Weeknd", "Central Cee", "Frank Ocean", "Tyler The Creator", "SZA", "Billie Eilish", "Doja Cat", "A$AP Rocky", "Lana Del Rey", "Metro Boomin"] },
  { title: "Społeczność", icon: "account-group", items: ["Nowi znajomi", "Randki", "LGBTQ+", "Wydarzenia", "Planszówkowe wieczory", "Karaoke", "Wolontariat", "Studia", "Erasmus", "Networking", "Wspólne wyjazdy", "Miasto nocą"] }
] as const;

const interestOptions = Array.from(new Set(interestCategories.flatMap((category) => category.items)));

type SharedInterestInsight = {
  title: string;
  icon: string;
  interests: string[];
};

const affinityInterestCategories = [
  { title: "Filmy i seriale", icon: "movie-open-outline", items: ["Filmy", "Seriale", "Kino studyjne", "Anime", "Teatr"] },
  { title: "Muzyka", icon: "music-note-heart", items: ["Muzyka", "Koncerty", "Karaoke", ...interestCategories[5].items, ...interestCategories[6].items] },
  { title: "Sport i ruch", icon: "run-fast", items: ["Sport", "Joga", ...interestCategories[2].items] },
  { title: "Podróże i natura", icon: "image-filter-hdr", items: ["Natura", "Podróże", "Fotografia", "Góry", "Nocne spacery", "Wspólne wyjazdy", "Erasmus"] },
  { title: "Tech i gry", icon: "controller", items: ["Tech", "Gaming", "Planszówki", "Planszówkowe wieczory", ...interestCategories[4].items] },
  { title: "Kultura i sztuka", icon: "palette-outline", items: ["Sztuka", "Książki", ...interestCategories[3].items] },
  { title: "Jedzenie i kawa", icon: "silverware-fork-knife", items: ["Kawa", "Kuchnia", "Gotowanie", "Kawiarnie", "Zdrowe jedzenie"] },
  { title: "Lifestyle", icon: "creation-outline", items: [...interestCategories[1].items] },
  { title: "Społeczność", icon: "account-group-outline", items: ["LGBT+", ...interestCategories[7].items] }
] as const;

function getSharedInterestInsights(profileInterests: string[], viewerInterests: string[]): SharedInterestInsight[] {
  const viewerSet = new Set(viewerInterests);
  const shared = Array.from(new Set(profileInterests.filter((interest) => viewerSet.has(interest))));
  const grouped = new Map<string, SharedInterestInsight>();

  shared.forEach((interest) => {
    const category = affinityInterestCategories.find((item) => (item.items as readonly string[]).includes(interest));
    const title = category?.title ?? "Inne pasje";
    const current = grouped.get(title) ?? { title, icon: category?.icon ?? "tag-heart-outline", interests: [] };
    current.interests.push(interest);
    grouped.set(title, current);
  });

  return Array.from(grouped.values()).sort((left, right) =>
    right.interests.length - left.interests.length || left.title.localeCompare(right.title, "pl")
  );
}

function formatSharedInterestInsight(insight: SharedInterestInsight) {
  const count = insight.interests.length;
  if (count === 1) return `Łączy Was: ${insight.interests[0]}`;
  const noun = count >= 2 && count <= 4 ? "zainteresowania" : "zainteresowań";
  return `Łączą Was ${count} ${noun} · ${insight.title}`;
}

const interestThemes: Record<string, { soft: string; active: string; border: string; text: string }> = {
  Filmy: { soft: "rgba(255,45,141,0.12)", active: "#ff2d8d", border: "rgba(255,45,141,0.28)", text: "#ff9ac8" },
  Natura: { soft: "rgba(52,199,89,0.13)", active: "#34c759", border: "rgba(52,199,89,0.28)", text: "#176b34" },
  Muzyka: { soft: "rgba(88,86,214,0.12)", active: "#5856d6", border: "rgba(88,86,214,0.28)", text: "#35339a" },
  Kawa: { soft: "rgba(176,111,56,0.14)", active: "#b06f38", border: "rgba(176,111,56,0.28)", text: "#70401f" },
  Sport: { soft: "rgba(0,122,255,0.12)", active: "#007aff", border: "rgba(0,122,255,0.28)", text: "#0050a4" },
  Sztuka: { soft: "rgba(255,149,0,0.14)", active: "#ff9500", border: "rgba(255,149,0,0.28)", text: "#9b5700" },
  Gaming: { soft: "rgba(175,82,222,0.13)", active: "#af52de", border: "rgba(175,82,222,0.28)", text: "#7330a0" },
  Kuchnia: { soft: "rgba(255,204,0,0.16)", active: "#d89b00", border: "rgba(216,155,0,0.26)", text: "#765000" },
  Fotografia: { soft: "rgba(90,200,250,0.14)", active: "#32ade6", border: "rgba(50,173,230,0.28)", text: "#126b91" },
  Tech: { soft: "rgba(48,209,88,0.12)", active: "#30d158", border: "rgba(48,209,88,0.28)", text: "#15712e" },
  Joga: { soft: "rgba(100,210,255,0.14)", active: "#64d2ff", border: "rgba(100,210,255,0.3)", text: "#12637f" },
  Koncerty: { soft: "rgba(255,55,95,0.13)", active: "#ff375f", border: "rgba(255,55,95,0.28)", text: "#a40e35" },
  "LGBT+": { soft: "rgba(191,90,242,0.13)", active: "#bf5af2", border: "rgba(191,90,242,0.28)", text: "#7933a0" },
  "Taco Hemingway": { soft: "rgba(255,159,10,0.14)", active: "#ff9f0a", border: "rgba(255,159,10,0.3)", text: "#8a5200" },
  Mata: { soft: "rgba(255,55,95,0.13)", active: "#ff375f", border: "rgba(255,55,95,0.3)", text: "#a40e35" },
  Quebonafide: { soft: "rgba(48,176,199,0.14)", active: "#30b0c7", border: "rgba(48,176,199,0.3)", text: "#11606e" },
  "Playboi Carti": { soft: "rgba(255,45,141,0.16)", active: "#ff2d8d", border: "rgba(255,45,141,0.34)", text: "#ff9ac8" },
  "Travis Scott": { soft: "rgba(94,92,230,0.14)", active: "#5e5ce6", border: "rgba(94,92,230,0.3)", text: "#37349b" },
  Drake: { soft: "rgba(10,132,255,0.13)", active: "#0a84ff", border: "rgba(10,132,255,0.3)", text: "#0057a8" },
  "Kendrick Lamar": { soft: "rgba(52,199,89,0.13)", active: "#34c759", border: "rgba(52,199,89,0.3)", text: "#176b34" }
};

const matchProfiles: MatchProfile[] = [
  {
    id: "bundled-test-aisha",
    isTestProfile: true,
    name: "Aisha",
    surname: "Nowak",
    age: 24,
    city: "Warszawa",
    bio: "Projektantka, łowczyni ukrytych kawiarni i galerii. Szuka kogoś do rozmów bez pośpiechu.",
    distance: "2 km",
    latitude: 52.2297,
    longitude: 21.0122,
    image: profileImages[0],
    interests: ["Kawa", "Sztuka", "Filmy", "Taco Hemingway"],
    intent: "Randki",
    intents: ["Randki", "Znajomi"],
    desiredAgeMin: 22,
    desiredAgeMax: 31,
    heightCm: 168,
    weightKg: 56,
    socials: [
      { label: "Instagram", value: "@aisha.design" },
      { label: "Spotify", value: "Indie evenings" }
    ],
    premium: true,
    likedYou: true
  },
  {
    id: "bundled-test-lena",
    isTestProfile: true,
    name: "Lena",
    surname: "Kowalska",
    age: 27,
    city: "Kraków",
    bio: "Fotografia analogowa, góry i niedzielne brunche. Najbardziej lubi ludzi, którzy pytają drugi raz.",
    distance: "5 km",
    latitude: 50.0647,
    longitude: 19.945,
    image: profileImages[1],
    interests: ["Fotografia", "Natura", "Kuchnia", "Kendrick Lamar"],
    intent: "Znajomi",
    intents: ["Znajomi", "LGBT+ / Społeczność"],
    desiredAgeMin: 24,
    desiredAgeMax: 34,
    heightCm: 172,
    weightKg: 61,
    socials: [
      { label: "Instagram", value: "@lenak.frames" },
      { label: "TikTok", value: "@lenak.moves" }
    ]
  },
  {
    id: "bundled-test-kuba",
    isTestProfile: true,
    name: "Kuba",
    surname: "Zieliński",
    age: 29,
    city: "Gdańsk",
    bio: "Koncerty, rower i dokumenty muzyczne. Zawsze zna mały lokal z dobrą sceną.",
    distance: "8 km",
    latitude: 54.352,
    longitude: 18.6466,
    image: profileImages[2],
    interests: ["Muzyka", "Koncerty", "Playboi Carti", "Travis Scott"],
    intent: "Randki",
    intents: ["Randki"],
    desiredAgeMin: 23,
    desiredAgeMax: 35,
    heightCm: 184,
    weightKg: 78,
    socials: [
      { label: "Spotify", value: "Kuba live set" }
    ]
  },
  {
    id: "bundled-test-mia",
    isTestProfile: true,
    name: "Mia",
    surname: "Wiśniewska",
    age: 25,
    city: "Poznań",
    bio: "Ceramika, książki i wypady za miasto. Ceni ciepły humor i jasne intencje.",
    distance: "3 km",
    latitude: 52.4064,
    longitude: 16.9252,
    image: profileImages[3],
    interests: ["Sztuka", "Natura", "Joga", "Quebonafide"],
    intent: "LGBT+ / Społeczność",
    intents: ["LGBT+ / Społeczność", "Znajomi"],
    desiredAgeMin: 21,
    desiredAgeMax: 30,
    heightCm: 165,
    weightKg: 54,
    socials: [
      { label: "Instagram", value: "@mia.studio" },
      { label: "Pinterest", value: "mia moodboard" }
    ],
    premium: true
  }
];

const premiumPlans = [
  {
    id: "weekly",
    title: "Spark Pro na tydzień",
    price: "19.99 zł",
    accent: "Dobry start",
    features: ["Zobacz, kto polubił Twój profil", "Wyślij prośbę o chat przed matchem", "Korona Pro przy profilowym"]
  },
  {
    id: "monthly",
    title: "Spark Pro na miesiąc",
    price: "49.99 zł",
    accent: "Najlepszy wybór",
    features: ["Zero reklam", "15 zdjęć profilu zamiast 3", "Częstsze pojawianie się na głównej"]
  },
  {
    id: "lifetime",
    title: "Spark Pro na zawsze",
    price: "199.99 zł",
    accent: "Bez limitu czasu",
    features: ["Wszystko z planu miesięcznego", "Spark Pro bez odnawiania", "Premium aktywne na zawsze"]
  }
] satisfies Array<{ id: SparkPlanId; title: string; price: string; accent: string; features: string[] }>;

function tap() {
  if (Platform.OS === "ios") {
    Haptics.selectionAsync();
  }
}

function toggleListItem(items: string[], item: string) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}

const legacyTextReplacements: Record<string, string> = {
  "\u00c4\u2026": "\u0105", "\u00c4\u2021": "\u0107", "\u00c4\u2122": "\u0119", "\u0139\u201a": "\u0142", "\u0139\u201e": "\u0144", "\u0102\u0142": "\u00f3", "\u0139\u203a": "\u015b", "\u0139\u015f": "\u017a", "\u0139\u013d": "\u017c",
  "\u00c4\u201e": "\u0104", "\u00c4\u2020": "\u0106", "\u00c4\u0098": "\u0118", "\u0139\u0081": "\u0141", "\u0139\u0083": "\u0143", "\u0102\u201c": "\u00d3", "\u0139\u0161": "\u015a", "\u0139\u0105": "\u0179", "\u0139\u00bb": "\u017b",
  "\u00e2\u20ac\u02d8": "\u2022", "\u00c2\u00b7": "\u00b7", "Krak w": "Krak\u00f3w", "G ry": "G\u00f3ry", "g ry": "g\u00f3ry"
};

function repairLegacyText(value: string) {
  return Object.entries(legacyTextReplacements).reduce(
    (result, [broken, corrected]) => result.split(broken).join(corrected),
    value
  );
}
function getInterestTheme(item: string, index = 0) {
  const fallbackThemes = [
    { soft: "rgba(255,45,141,0.12)", active: "#ff2d8d", border: "rgba(255,45,141,0.28)", text: "#ff9ac8" },
    { soft: "rgba(52,199,89,0.13)", active: "#34c759", border: "rgba(52,199,89,0.28)", text: "#176b34" },
    { soft: "rgba(88,86,214,0.12)", active: "#5856d6", border: "rgba(88,86,214,0.28)", text: "#35339a" },
    { soft: "rgba(255,149,0,0.14)", active: "#ff9500", border: "rgba(255,149,0,0.28)", text: "#9b5700" },
    { soft: "rgba(90,200,250,0.14)", active: "#32ade6", border: "rgba(50,173,230,0.28)", text: "#126b91" },
    { soft: "rgba(175,82,222,0.13)", active: "#af52de", border: "rgba(175,82,222,0.28)", text: "#7330a0" }
  ];

  return interestThemes[item] ?? fallbackThemes[index % fallbackThemes.length];
}

const interestIconMap: Record<string, string> = {
  Filmy: "movie-open-outline",
  Natura: "leaf",
  Muzyka: "music-note",
  Kawa: "coffee-outline",
  Sport: "run",
  Sztuka: "palette-outline",
  Podróże: "airplane",
  Gaming: "controller",
  Książki: "book-open-page-variant-outline",
  Kuchnia: "silverware-fork-knife",
  Fotografia: "camera-outline",
  Tech: "laptop",
  Joga: "meditation",
  Koncerty: "ticket-outline",
  Planszówki: "dice-multiple-outline",
  Moda: "hanger",
  Streetwear: "shoe-sneaker",
  Siłownia: "dumbbell",
  Bieganie: "run-fast",
  Gotowanie: "chef-hat",
  Kawiarnie: "coffee",
  Taniec: "dance-ballroom",
  Góry: "image-filter-hdr",
  Teatr: "drama-masks",
  Muzea: "bank-outline",
  Design: "vector-square",
  Architektura: "office-building-outline",
  Seriale: "television-classic",
  Podcasty: "podcast",
  AI: "robot-outline",
  Programowanie: "code-tags",
  Minecraft: "cube-outline",
  Randki: "heart-multiple-outline",
  Wolontariat: "hand-heart-outline",
  Karaoke: "microphone-variant"
};

function getInterestIcon(item: string, fallback: string) {
  return interestIconMap[item] ?? fallback;
}

function getProfileKey(profile: MatchProfile) {
  return profile.id;
}


function buildConversationStarters(profile: MatchProfile, viewerInterests: string[]) {
  const sharedEvent = profile.sharedEvents?.find(isEventActive);
  const shared = profile.interests.filter((interest) => viewerInterests.includes(interest));
  const topics = Array.from(new Set([...shared, ...getFeaturedInterests(profile), ...profile.interests])).slice(0, 2);
  const firstTopic = topics[0];
  const secondTopic = topics[1] ?? firstTopic;
  const starters = [
    sharedEvent
      ? `Hej ${profile.name}! Też wybierasz się na „${sharedEvent.name}”. Co przekonało Cię do tego wydarzenia?`
      : null,
    firstTopic
      ? `Hej ${profile.name}! Widzę, że też wybierasz „${firstTopic}”. Co najbardziej Cię w tym kręci?`
      : `Hej ${profile.name}! Co ostatnio poprawiło Ci humor?`,
    secondTopic
      ? `Jedno pytanie na start: jaki był Twój ostatni dobry moment związany z „${secondTopic}”?`
      : "Szybki wybór na pierwsze spotkanie: kawa, spacer czy coś spontanicznego?",
    "Mamy match, więc szybki wybór: kawa, spacer czy długa rozmowa?"
  ];

  return Array.from(new Set(starters.filter((starter): starter is string => Boolean(starter)))).slice(0, 3);
}

function getProfileGallery(profile: MatchProfile) {
  if (profile.id) {
    return (profile.photos && profile.photos.length > 0 ? profile.photos : [profile.image]).slice(0, 15);
  }

  const fallbackPhotos = [profile.image, ...profileImages.filter((image) => image !== profile.image)];
  return (profile.photos && profile.photos.length > 0 ? profile.photos : fallbackPhotos).slice(0, 3);
}

function getFeaturedInterests(profile: MatchProfile) {
  return (profile.featuredInterests && profile.featuredInterests.length > 0 ? profile.featuredInterests : profile.interests).slice(0, 3);
}

function mapRemoteProfile(item: Record<string, unknown>): MatchProfile | null {
  if (item.moderationStatus === "suspended") return null;
  const id = typeof item.id === "string" ? item.id : null;
  const nameMode = item.profileNameMode === "nickname" ? "nickname" : "realName";
  const nickname = typeof item.nickname === "string" ? repairLegacyText(item.nickname.trim()) : "";
  const firstName = typeof item.firstName === "string" ? repairLegacyText(item.firstName.trim()) : "";
  const rawSurname = typeof item.lastName === "string" ? repairLegacyText(item.lastName.trim()) : "";
  const interests = Array.isArray(item.interests) ? item.interests.filter((value): value is string => typeof value === "string").map(repairLegacyText) : [];
  const testOverride = id && item.isTestProfile === true ? bundledTestProfileOverrides[id] : undefined;
  const name = testOverride?.name ?? (nameMode === "nickname" && nickname ? nickname : firstName);
  const surname = testOverride || (nameMode === "nickname" && nickname) ? "" : rawSurname;
  const storedIntents = normalizeSparkIntents(item.intents, item.intent);
  const intents = testOverride && id ? bundledTestProfileIntents[id] : storedIntents.length > 0 ? storedIntents : (id && item.isTestProfile === true ? ["Znajomi" as SparkIntent] : []);
  const photoUrls = Array.isArray(item.photoUrls) ? item.photoUrls.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
  const mainPhotoUrl = typeof item.mainPhotoUrl === "string" && item.mainPhotoUrl.length > 0 ? item.mainPhotoUrl : photoUrls[0];
  const bundledTestImage = id && item.isTestProfile === true ? bundledTestProfileImages[id] : undefined;

  if (!id || !name || !mainPhotoUrl || interests.length === 0) {
    return null;
  }

  const location = typeof item.location === "object" && item.location !== null ? item.location as Record<string, unknown> : null;
  const latitude = typeof location?.latitude === "number" ? location.latitude : 52.2297;
  const longitude = typeof location?.longitude === "number" ? location.longitude : 21.0122;
  const locationAvailable = typeof location?.latitude === "number" && typeof location?.longitude === "number";
  const socials = socialHandlesToProfileSocials(getSocialHandles(item.socials));
  const updatedAt = item.updatedAt as { toMillis?: () => number } | undefined;
  const city = typeof item.city === "string" && item.city.trim() ? repairLegacyText(item.city.trim()) : "Twoja okolica";
  const activeEvents = sanitizeActiveEvents(Array.isArray(item.activeEvents) ? item.activeEvents : []);

  return {
    id,
    name,
    surname,
    age: typeof item.age === "number" ? Math.max(18, Math.min(99, Math.round(item.age))) : 18,
    city,
    country: typeof item.country === "string" && item.country.trim() ? repairLegacyText(item.country.trim()) : undefined,
    bio: typeof item.bio === "string" && item.bio.trim()
      ? repairLegacyText(item.bio.trim())
      : intents[0]
        ? "Jestem tu po: " + intents[0] + "."
        : "Nowy profil w Spark. Poznajcie się przez wspólne zainteresowania.",
    distance: locationAvailable ? "w pobliżu" : "Twoja okolica",
    latitude,
    longitude,
    locationAvailable,
    image: bundledTestImage ?? { uri: mainPhotoUrl },
    photos: bundledTestImage ? [bundledTestImage] : (photoUrls.length > 0 ? photoUrls : [mainPhotoUrl]).map((uri) => ({ uri })),
    interests,
    featuredInterests: interests.slice(0, 3),
    socials,
    premium: item.isPro === true,
    verified: item.isVerified === true,
    lgbtTag: Array.isArray(item.lgbtTag) ? item.lgbtTag.filter((value): value is string => typeof value === "string").slice(0, 5) : null,
    likedYou: item.likedYou === true,
    isTestProfile: item.isTestProfile === true,
    desiredAgeMin: typeof item.desiredAgeMin === "number" ? item.desiredAgeMin : 18,
    desiredAgeMax: typeof item.desiredAgeMax === "number" ? item.desiredAgeMax : 99,
    heightCm: typeof item.heightCm === "number" ? item.heightCm : undefined,
    weightKg: typeof item.weightKg === "number" ? item.weightKg : undefined,
    intent: intents[0],
    intents,
    gender: normalizeProfileGender(testOverride?.gender ?? item.gender),
    desiredGendersByIntent: normalizeGenderPreferences(item.desiredGendersByIntent),
    activeEvents,
    updatedAtMs: typeof updatedAt?.toMillis === "function" ? updatedAt.toMillis() : undefined
  };
}
function formatBirthDateInput(value: string) {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join("-");
}

function calculateAge(birthDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function getProfileDisplayName(mode: ProfileNameMode, nickname: string, firstName: string, lastName: string) {
  if (mode === "nickname" && nickname.trim()) return nickname.trim();
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || "Twój profil";
}

function getApproximatePublicLocation(location: UserLocation | null): UserLocation | null {
  if (!location) return null;
  return {
    latitude: Math.round(location.latitude * 100) / 100,
    longitude: Math.round(location.longitude * 100) / 100
  };
}
function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getApproxDistanceLabel(userLocation: UserLocation | null, profile: MatchProfile) {
  const distanceKm = getDistanceKm(userLocation, profile);
  if (distanceKm === null) return [profile.city, profile.country].filter(Boolean).join(", ") || "Lokalizacja ukryta";
  return formatDistance(distanceKm);
}

function getDistanceKm(userLocation: UserLocation | null, profile: MatchProfile): number | null {
  if (!userLocation || profile.locationAvailable === false) return null;
  const earthRadiusKm = 6371;
  const latitudeDelta = degreesToRadians(profile.latitude - userLocation.latitude);
  const longitudeDelta = degreesToRadians(profile.longitude - userLocation.longitude);
  const startLatitude = degreesToRadians(userLocation.latitude);
  const endLatitude = degreesToRadians(profile.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function scoreProfileMatch(params: {
  profile: MatchProfile;
  selectedInterests: string[];
  userLocation: UserLocation | null;
  userAge: number;
  userIntents: SparkIntent[];
  userCity: string;
  viewerUid: string;
}) {
  const distanceKm = getDistanceKm(params.userLocation, params.profile);
  const sharedInterests = params.profile.interests.filter((interest) => params.selectedInterests.includes(interest));
  const overlapBase = Math.max(1, Math.min(params.selectedInterests.length, params.profile.interests.length));
  const sharedRatio = sharedInterests.length / overlapBase;
  const interestMatchPercent = params.selectedInterests.length > 0 ? Math.round(sharedRatio * 100) : 0;
  const interestScore = params.selectedInterests.length > 0
    ? Math.min(34, sharedInterests.length * 7 + Math.round(sharedRatio * 12))
    : 12;
  const normalizedViewerCity = params.userCity.trim().toLocaleLowerCase("pl-PL");
  const sameCity = Boolean(normalizedViewerCity) && params.profile.city.trim().toLocaleLowerCase("pl-PL") === normalizedViewerCity;
  const localFallback = sameCity || (distanceKm !== null && distanceKm <= 50);
  const recommendationTier = sharedInterests.length > 0 ? 2 : localFallback ? 1 : 0;
  const viewerIntents = normalizeSparkIntents(params.userIntents);
  const profileIntents = getProfileIntents(params.profile);
  const sharedIntents = profileIntents.filter((value) => viewerIntents.includes(value));
  const sharedIntentCount = sharedIntents.length;
  const intentScore = sharedIntentCount > 0
    ? Math.min(20, 10 + sharedIntentCount * 5)
    : viewerIntents.length > 0 && profileIntents.length > 0
      ? 3
      : 5;
  const distanceScore = distanceKm === null ? 5 : distanceKm <= 5 ? 18 : distanceKm <= 15 ? 14 : distanceKm <= 35 ? 10 : distanceKm <= 100 ? 6 : 2;
  const ageGap = Math.abs(params.profile.age - params.userAge);
  const ageScore = ageGap <= 3 ? 12 : ageGap <= 7 ? 9 : ageGap <= 12 ? 5 : 2;
  const inTheirRange =
    params.userAge >= (params.profile.desiredAgeMin ?? 18) &&
    params.userAge <= (params.profile.desiredAgeMax ?? 99);
  const preferenceScore = inTheirRange ? 10 : 0;
  const completenessScore = ((params.profile.photos?.length ?? 1) >= 2 ? 3 : 1) + (params.profile.interests.length >= 5 ? 1 : 0);
  const profileAgeDays = params.profile.updatedAtMs ? Math.max(0, (Date.now() - params.profile.updatedAtMs) / 86_400_000) : null;
  const freshnessScore = profileAgeDays === null ? 1 : profileAgeDays <= 3 ? 5 : profileAgeDays <= 14 ? 3 : profileAgeDays <= 60 ? 2 : 0;
  const visibilityBoostScore = params.profile.premium ? 4 : 0;
  const dayKey = new Date().toISOString().slice(0, 10);
  const rotationSeed = `${params.viewerUid}:${getProfileKey(params.profile)}:${dayKey}`;
  const rotationScore = Array.from(rotationSeed).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7) % 5;
  const score = Math.max(15, Math.min(98, interestScore + intentScore + distanceScore + ageScore + preferenceScore + completenessScore + freshnessScore + visibilityBoostScore + rotationScore));
  const compatibilityInterestScore = params.selectedInterests.length > 0 ? Math.round(interestMatchPercent * 0.4) : 12;
  const compatibilityIntentScore = sharedIntentCount > 0 ? 20 : viewerIntents.length > 0 && profileIntents.length > 0 ? 4 : 8;
  const compatibilityDistanceScore = distanceKm === null ? 8 : distanceKm <= 15 ? 15 : distanceKm <= 35 ? 12 : distanceKm <= 100 ? 8 : 3;
  const compatibilityAgeScore = ageGap <= 3 ? 10 : ageGap <= 7 ? 8 : ageGap <= 12 ? 5 : 2;
  const compatibilityPreferenceScore = inTheirRange ? 15 : 3;
  const compatibilityScore = Math.max(15, Math.min(98, compatibilityInterestScore + compatibilityIntentScore + compatibilityDistanceScore + compatibilityAgeScore + compatibilityPreferenceScore));
  const reasons = [
    sharedIntentCount > 0 ? "wspólny cel: " + sharedIntents.join(" + ") : profileIntents[0] ? "cel profilu: " + profileIntents[0] : "otwarty profil",
    interestMatchPercent + "% zgodności zainteresowań",
    distanceKm === null ? [params.profile.city, params.profile.country].filter(Boolean).join(", ") || "lokalizacja ukryta" : formatDistance(distanceKm) + " od Ciebie"
  ];
  return { score, compatibilityScore, reasons, sharedInterests, interestMatchPercent, recommendationTier };
}

type CompatibilityTier = "soulmate" | "strong" | "vibe" | "potential" | "discovery";

function getCompatibilityPresentation(rawScore: number) {
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  if (score >= 90) return { score, tier: "soulmate" as CompatibilityTier, label: "SOULMATE", detail: "Wyjątkowa zgodność", icon: "heart-multiple" as const, color: "#ffd166", background: "rgba(255,45,141,0.3)", border: "rgba(255,209,102,0.72)" };
  if (score >= 80) return { score, tier: "strong" as CompatibilityTier, label: "MOCNA ISKRA", detail: "Bardzo wysoka zgodność", icon: "fire" as const, color: "#ff9f43", background: "rgba(255,99,72,0.2)", border: "rgba(255,159,67,0.55)" };
  if (score >= 65) return { score, tier: "vibe" as CompatibilityTier, label: "DOBRY VIBE", detail: "Wiele punktów wspólnych", icon: "creation" as const, color: "#ff65ad", background: "rgba(255,45,141,0.16)", border: "rgba(255,101,173,0.42)" };
  if (score >= 45) return { score, tier: "potential" as CompatibilityTier, label: "JEST POTENCJAŁ", detail: "Warto się poznać", icon: "account-heart" as const, color: "#9f8cff", background: "rgba(125,103,255,0.15)", border: "rgba(159,140,255,0.38)" };
  return { score, tier: "discovery" as CompatibilityTier, label: "NOWE ODKRYCIE", detail: "Daj szansę rozmowie", icon: "compass-outline" as const, color: "#65c7ff", background: "rgba(50,173,230,0.13)", border: "rgba(101,199,255,0.35)" };
}

function showCompatibilityInfo(score: number, interestMatchPercent: number, insight?: SharedInterestInsight) {
  const tier = getCompatibilityPresentation(score);
  const sharedContext = insight ? "\n\n" + formatSharedInterestInsight(insight) + "." : "";
  Alert.alert(
    tier.label + " · " + tier.score + "%",
    tier.detail + ". Wynik uwzględnia wspólne zainteresowania (" + interestMatchPercent + "%), cel poznania, wzajemne preferencje wieku, odległość i kompletność profilu." + sharedContext + "\n\nTo podpowiedź Spark, nie gwarancja relacji."
  );
}

function showVerifiedProfileInfo() {
  Alert.alert(
    "Profil zweryfikowany",
    "Odznaka oznacza, że konto logowania zostało potwierdzone przez Google lub Apple. Nie oznacza weryfikacji dokumentu, wieku ani zgodności zdjęcia z osobą."
  );
}


function isDailyTestProfileKey(profileKey: string) {
  return profileKey.startsWith("spark_test_") || profileKey.includes("_spark_test_");
}

function getThreadId(uid: string | null | undefined, profileKey: string) {
  return `${uid || "local"}_${profileKey}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getConversationId(uid: string, profileKey: string) {
  return [uid, profileKey].sort().join("_").replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function pickImageFromLibrary() {
  try {
    if (Platform.OS === "android") {
      const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
      const permission = existing.granted ? existing : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Dostęp do zdjęć", "Nadaj Spark dostęp do zdjęć, aby dodać zdjęcie profilowe.", [
          { text: "Anuluj", style: "cancel" },
          { text: "Otwórz ustawienia", onPress: () => { void Linking.openSettings(); } }
        ]);
        return null;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.88
    });
    return result.canceled ? null : result.assets[0]?.uri ?? null;
  } catch {
    Alert.alert("Galeria", "Nie udało się otworzyć galerii. Spróbuj ponownie lub sprawdź ustawienia Spark.", [
      { text: "Anuluj", style: "cancel" },
      { text: "Otwórz ustawienia", onPress: () => { void Linking.openSettings(); } }
    ]);
    return null;
  }
}

function AppContent() {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [authDone, setAuthDone] = useState(false);
  const [authRestoring, setAuthRestoring] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileNameMode, setProfileNameMode] = useState<ProfileNameMode>("realName");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<ProfileGender>("unspecified");
  const [birthDate, setBirthDate] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [socialHandles, setSocialHandles] = useState<SocialHandles>(emptySocialHandles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [onboarded, setOnboarded] = useState(false);
  const [intents, setIntents] = useState<SparkIntent[]>(["Randki"]);
  const [lgbt, setLgbt] = useState<LgbtSettings | null>(null);
  const [lgbtBusy, setLgbtBusy] = useState(false);
  // Tags others show only to LGBT+ people (fetched for members only).
  const [communityTags, setCommunityTags] = useState<Record<string, string[]>>({});
  const communityTagsFetched = useRef(new Set<string>());
  const [ageBand, setAgeBand] = useState<AgeBand>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("discover");
  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>("people");
  const [discoverFilters, setDiscoverFilters] = useState<DiscoverFilters>(createDefaultDiscoverFilters);
  const [activeEvents, setActiveEvents] = useState<SparkEvent[]>([]);
  const [sparkEvents, setSparkEvents] = useState<SparkEvent[]>([]);
  const [sparkEventsLoading, setSparkEventsLoading] = useState(false);
  const [sparkEventsError, setSparkEventsError] = useState<string | null>(null);
  const [sparkEventDetails, setSparkEventDetails] = useState<Record<string, EventDetails>>({});
  const [eventProposals, setEventProposals] = useState<EventProposal[]>([]);
  const [eventProposalsLoading, setEventProposalsLoading] = useState(false);
  const [eventProposalsError, setEventProposalsError] = useState<string | null>(null);
  const [eventCatalogReload, setEventCatalogReload] = useState(0);
  const proposalLoadSequence = useRef(0);
  const [eventProfiles, setEventProfiles] = useState<MatchProfile[]>([]);
  const [eventManagerOpen, setEventManagerOpen] = useState(false);
  const [eventProfilesLoading, setEventProfilesLoading] = useState(false);
  const [eventProfilesError, setEventProfilesError] = useState<string | null>(null);
  const [expiredEventsCount, setExpiredEventsCount] = useState(0);

  const [premiumPlan, setPremiumPlan] = useState<SparkPlanId>("monthly");
  const [premiumEntrySource, setPremiumEntrySource] = useState<PremiumEntrySource>("navigation");
  const [appUser, setAppUser] = useState<AppAuthUser | null>(null);
  const currentEventUser = useRef<string | null>(null);
  currentEventUser.current = appUser?.uid ?? null;
  const [profileVerificationStatus, setProfileVerificationStatus] = useState<ProfileVerificationStatus>("none");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [releaseConfig, setReleaseConfig] = useState<SparkReleaseConfig>(defaultSparkReleaseConfig);
  const [feedExpansionLevel, setFeedExpansionLevel] = useState<0 | 1 | 2>(0);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);
  const ownerProAccess = isSparkOwnerAccount(appUser?.email, appUser?.emailVerified);
  const revenueCat = useRevenueCat(appUser?.uid ?? null, ownerProAccess);
  const adsReady = useGoogleMobileAds(!revenueCat.isPro);
  const trackSwipeAd = useSwipeInterstitialAds(
    !revenueCat.isPro && adsReady && tab === "discover",
    releaseConfig.swipesPerInterstitial,
    releaseConfig.interstitialMinIntervalSeconds,
    releaseConfig.maxInterstitialsPerSession
  );
  // Calm screens get a banner; Discover gets a sponsored card in the deck.
  const showCurrentBanner = !revenueCat.isPro && adsReady && (tab === "matches" || tab === "profile");
  const sponsoredSwipes = useRef(0);
  const [sponsoredCard, setSponsoredCard] = useState<"idle" | "loading" | "visible">("idle");
  function noteFeedSwipe() {
    // A full-screen ad already interrupted this swipe: no card on top of it.
    if (trackSwipeAd()) { sponsoredSwipes.current = 0; return; }
    if (revenueCat.isPro || !adsReady || sponsoredCard !== "idle") return;
    sponsoredSwipes.current += 1;
    if (sponsoredSwipes.current >= SPONSORED_CARD_EVERY) {
      sponsoredSwipes.current = 0;
      setSponsoredCard("loading");
    }
  }

  useEffect(() => {
    if (sponsoredCard !== "loading") return;
    // Never show an empty card: give the ad a few seconds, else skip it.
    const timer = setTimeout(() => setSponsoredCard((current) => (current === "loading" ? "idle" : current)), 8000);
    return () => clearTimeout(timer);
  }, [sponsoredCard]);

  useEffect(() => {
    if (revenueCat.isPro) setSponsoredCard("idle");
  }, [revenueCat.isPro]);
  const [likedProfileKeys, setLikedProfileKeys] = useState<string[]>([]);
  const [passedProfileKeys, setPassedProfileKeys] = useState<string[]>([]);
  const [matchedProfileKeys, setMatchedProfileKeys] = useState<string[]>([]);
  const [matchCelebrationProfile, setMatchCelebrationProfile] = useState<MatchProfile | null>(null);
  const [matchCelebrationKind, setMatchCelebrationKind] = useState<"mutual" | "sparkLike">("mutual");
  const [chatRequestKeys, setChatRequestKeys] = useState<string[]>([]);
  const [incomingLikeKinds, setIncomingLikeKinds] = useState<Record<string, "like" | "superlike">>({});
  const [blockedProfileKeys, setBlockedProfileKeys] = useState<string[]>([]);
  const [chatThreads, setChatThreads] = useState<Record<string, ChatThread>>({});
  const sendingMessageKeysRef = useRef(new Set<string>());
  const markingReadThreadIdsRef = useRef(new Set<string>());
  const recentMessageTimesRef = useRef<number[]>([]);
  const deferredSwipeAdRef = useRef(false);
  const discoveryRefreshBusyRef = useRef(false);
  const [selectedChatKey, setSelectedChatKey] = useState<string | null>(null);
  const [pendingNotificationThreadId, setPendingNotificationThreadId] = useState<string | null>(null);
  const [pendingMessageDraft, setPendingMessageDraft] = useState<{ profileKey: string; text: string } | null>(null);
  const [superlikesRemaining, setSuperlikesRemaining] = useState(10);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [userCity, setUserCity] = useState("");
  const [userCountry, setUserCountry] = useState("");
  const [userCountryCode, setUserCountryCode] = useState(() => getDeviceCountryCode() ?? "");
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [locationBusy, setLocationBusy] = useState(false);
  const [userAge, setUserAge] = useState(18);
  const [profilePhotos, setProfilePhotos] = useState<ProfilePhoto[]>([]);
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const [remoteProfiles, setRemoteProfiles] = useState<MatchProfile[]>([]);
  const [profileViewers, setProfileViewers] = useState<MatchProfile[]>([]);
  const [profileViewerCount, setProfileViewerCount] = useState(0);
  const [profileViewersLoading, setProfileViewersLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileFeedError, setProfileFeedError] = useState<string | null>(null);
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [profileCursor, setProfileCursor] = useState<DiscoveryCursor | null>(null);
  const [profilesHaveMore, setProfilesHaveMore] = useState(false);
  const [profilesLoadingMore, setProfilesLoadingMore] = useState(false);
  const [nextTestResetAt, setNextTestResetAt] = useState<number | null>(null);


  const isCompact = width < 380;
  const unreadMessageCount = useMemo(
    () => Object.values(chatThreads).reduce((total, thread) => total + (thread.status === "matched" ? Math.max(0, thread.unreadCount ?? 0) : 0), 0),
    [chatThreads]
  );
  const incomingChatRequestCount = useMemo(
    () => Object.values(chatThreads).filter((thread) => thread.status === "requested" && thread.requestDirection === "incoming").length,
    [chatThreads]
  );
  const messageAttentionCount = unreadMessageCount + incomingChatRequestCount;
  const selectedChatThreadId = selectedChatKey ? chatThreads[selectedChatKey]?.threadId ?? null : null;
  const profileLookupInterests = useMemo(
    () => Array.from(new Set([...discoverFilters.targetInterests, ...selectedInterests])).slice(0, 10),
    [discoverFilters.targetInterests, selectedInterests]
  );
  const discoverLens = lensFromIntents(discoverFilters.targetIntents, intents);
  const activeLensIntents = useMemo(() => lensIntentsFor(discoverLens), [discoverLens]);
  const deckMode: DeckMode = discoverMode === "events" ? "event" : discoverLens;
  const profileQueryKey = [...profileLookupInterests, ...activeLensIntents, userCity.trim().toLocaleLowerCase("pl-PL")].slice().sort().join("|");
  const activeEventIdsKey = activeEvents.map((event) => event.id).sort().join("|");
  const availableProfiles = useMemo(
    () => (remoteProfiles.length > 0 ? remoteProfiles : __DEV__ ? matchProfiles : []),
    [remoteProfiles]
  );

  useEffect(() => {
    if (!appUser?.uid || lgbt?.member !== true) return;
    const missing = availableProfiles.map((profile) => profile.id).filter((id): id is string => typeof id === "string" && !communityTagsFetched.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => communityTagsFetched.current.add(id));
    // The callable takes up to 40 profiles per call.
    for (let start = 0; start < missing.length; start += 40) {
      const batch = missing.slice(start, start + 40);
      getLgbtCommunityTags(batch)
        .then((tags) => setCommunityTags((current) => ({ ...current, ...tags })))
        .catch(() => batch.forEach((id) => communityTagsFetched.current.delete(id)));
    }
  }, [appUser?.uid, lgbt?.member, availableProfiles]);

  // After sign-out the next account never inherits this LGBT+ data.
  useEffect(() => {
    if (appUser?.uid) return;
    if (lgbtSaveTimer.current) clearTimeout(lgbtSaveTimer.current);
    lgbtSaveTimer.current = null;
    lgbtSaved.current = null;
    setLgbt(null);
    setCommunityTags({});
    communityTagsFetched.current.clear();
  }, [appUser?.uid]);

  // Changes show at once; one save goes out after a short pause, so quick
  // taps (switch + several identities) are never lost.
  const lgbtSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lgbtSaved = useRef<LgbtSettings | null>(null);
  useEffect(() => () => { if (lgbtSaveTimer.current) clearTimeout(lgbtSaveTimer.current); }, []);

  function changeLgbt(value: LgbtSettings) {
    if (!appUser) return;
    const uid = appUser.uid;
    setLgbt(value);
    if (!value.member) { setCommunityTags({}); communityTagsFetched.current.clear(); }
    if (lgbtSaveTimer.current) clearTimeout(lgbtSaveTimer.current);
    lgbtSaveTimer.current = setTimeout(() => {
      lgbtSaveTimer.current = null;
      setLgbtBusy(true);
      updateUserLgbt(uid, value)
        .then((saved) => { lgbtSaved.current = saved; })
        .catch((error) => {
          recordSparkError(error, "lgbt_save");
          if (!lgbtSaveTimer.current) setLgbt(lgbtSaved.current);
          Alert.alert("Tag LGBT+", "Nie udało się zapisać ustawienia. Sprawdź połączenie i spróbuj ponownie.");
        })
        .finally(() => setLgbtBusy(false));
    }, 700);
  }
  const profileName = getProfileDisplayName(profileNameMode, nickname, firstName, lastName);
  function openPremium(source: PremiumEntrySource = "navigation") {
    setPremiumEntrySource(source);
    setTab("premium");
  }
  const canViewTestProfiles = __DEV__ || configuredTestProfileViewerEmails.includes(email.trim().toLowerCase());
  const isReviewDemoAccount = builtInTestProfileViewerEmails.includes((appUser?.email ?? "").trim().toLowerCase());

  useEffect(() => {
    if (!appUser?.uid || !onboarded || !isReviewDemoAccount) return;
    void prepareReviewDemo().catch(() => undefined);
  }, [appUser?.uid, onboarded, isReviewDemoAccount]);
  const canManageSparkEvents = (appUser?.email ?? email).trim().toLowerCase() === sparkEventAdminEmail;

  async function loadEventProposals() {
    const uid = appUser?.uid;
    if (!uid) return;
    const sequence = ++proposalLoadSequence.current;
    setEventProposalsLoading(true); setEventProposalsError(null);
    try {
      const proposals = canManageSparkEvents ? await listPendingEventProposals() : await listMyEventProposals(uid);
      if (sequence === proposalLoadSequence.current && currentEventUser.current === uid) setEventProposals(proposals);
    } catch {
      if (sequence === proposalLoadSequence.current && currentEventUser.current === uid) setEventProposalsError("Nie udało się pobrać zgłoszeń. Spróbuj ponownie.");
    } finally {
      if (sequence === proposalLoadSequence.current && currentEventUser.current === uid) setEventProposalsLoading(false);
    }
  }

  useEffect(() => {
    proposalLoadSequence.current += 1;
    setEventProposals([]); setEventProposalsError(null); setEventProposalsLoading(false);
    setSparkEventDetails({});
  }, [appUser?.uid]);

  useEffect(() => {
    if (eventManagerOpen) void loadEventProposals();
  }, [eventManagerOpen, appUser?.uid, canManageSparkEvents]);

  useEffect(() => {
    let mounted = true;
    void initializeSparkTelemetry()
      .then((config) => {
        if (mounted) setReleaseConfig(config);
      })
      .catch((error) => recordSparkError(error, "telemetry_initialize"));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    void identifyTelemetryUser(appUser?.uid ?? null, revenueCat.isPro).catch((error) => {
      recordSparkError(error, "telemetry_identify");
    });
  }, [appUser?.uid, revenueCat.isPro]);

  useEffect(() => {
    if (!appUser?.uid) return;
    return observeModerationStatus(
      appUser.uid,
      (status) => {
        if (status !== "suspended") return;
        setAuthError("Twoje konto zosta\u0142o zawieszone. Skontaktuj si\u0119 z zespo\u0142em Spark, je\u015bli uwa\u017casz, \u017ce to pomy\u0142ka.");
        void signOutUser().catch((error) => recordSparkError(error, "suspended_account_sign_out"));
      },
      (error) => recordSparkError(error, "moderation_status_observer")
    );
  }, [appUser?.uid]);

  useEffect(() => {
    if (!appUser?.uid) return;
    return observeVerificationStatus(
      appUser.uid,
      setProfileVerificationStatus,
      (error) => recordSparkError(error, "profile_verification_observer")
    );
  }, [appUser?.uid]);

  useEffect(() => {
    const screenName = !authDone ? "auth" : !onboarded ? "onboarding" : discoverMode === "events" && tab === "discover" ? "event_feed" : tab;
    trackSparkScreen(screenName);
  }, [authDone, discoverMode, onboarded, tab]);

  const sortedProfiles = useMemo(
    () =>
      availableProfiles
        .filter((profile) => getProfileKey(profile) !== appUser?.uid)
        .filter((profile) => !blockedProfileKeys.includes(getProfileKey(profile)))
        .filter((profile) => profile.age >= discoverFilters.ageMin && profile.age <= discoverFilters.ageMax)

        .filter((profile) => {
          // "Bez lokalizacji" off = the distance limit is absolute and is never widened.
          // Without the viewer location no distance can be checked at all.
          if (!userLocation) return true;
          const distance = getDistanceKm(userLocation, profile);
          if (distance === null) return discoverFilters.includeProfilesWithoutLocation;
          const strict = !discoverFilters.includeProfilesWithoutLocation;
          return distance <= (
            strict || feedExpansionLevel === 0
              ? discoverFilters.maxDistanceKm
              : feedExpansionLevel === 1
                ? Math.max(250, discoverFilters.maxDistanceKm)
                : Number.POSITIVE_INFINITY
          );
        })
        .map((profile) => (profile.lgbtTag || !profile.id || !communityTags[profile.id] ? profile : { ...profile, lgbtTag: communityTags[profile.id] }))
        .filter((profile) => !discoverFilters.lgbtOnly || Boolean(profile.lgbtTag?.length))
        .filter((profile) => getProfileIntents(profile).some((profileIntent) => activeLensIntents.includes(profileIntent)))
        .filter((profile) => genderPreferenceMatches(profile, gender, discoverFilters.targetGendersByIntent, activeLensIntents))
        .filter((profile) => discoverFilters.targetInterests.length === 0 || profile.interests.some((interest) => discoverFilters.targetInterests.includes(interest)))
        .filter((profile) => !discoverFilters.requireCommonInterests || profile.interests.some((interest) => selectedInterests.includes(interest)))
        .filter((profile) => userAge >= (profile.desiredAgeMin ?? 18) && userAge <= (profile.desiredAgeMax ?? 99))
        .filter((profile) => !discoverFilters.proOnly || Boolean(profile.premium))
        .map((profile) => {
          const result = scoreProfileMatch({
            profile,
            selectedInterests,
            userLocation,
            userAge,
            userIntents: intents,
            userCity,
            viewerUid: appUser?.uid ?? "guest"
          });

          return {
            ...profile,
            distance: getApproxDistanceLabel(userLocation, profile),
            matchScore: result.score,
            compatibilityScore: result.compatibilityScore,
            interestMatchPercent: result.interestMatchPercent,
            recommendationTier: result.recommendationTier,
            matchReasons: result.reasons
          };
        })
        .sort((left, right) => {
          const tierDifference = (right.recommendationTier ?? 0) - (left.recommendationTier ?? 0);
          const scoreDifference = (right.matchScore ?? 0) - (left.matchScore ?? 0);
          return tierDifference || scoreDifference || (right.updatedAtMs ?? 0) - (left.updatedAtMs ?? 0) || getProfileKey(left).localeCompare(getProfileKey(right));
        }),
    [activeLensIntents, appUser?.uid, availableProfiles, blockedProfileKeys, communityTags, discoverFilters, feedExpansionLevel, gender, intents, selectedInterests, userAge, userCity, userLocation]
  );
  const discoverProfiles = sortedProfiles.filter((profile) => {
    const key = getProfileKey(profile);
    return (
      !likedProfileKeys.includes(key) &&
      !passedProfileKeys.includes(key) &&
      !matchedProfileKeys.includes(key) &&
      !chatRequestKeys.includes(key)
    );
  });
  const eventProfileSource = useMemo(() => {
    const profiles = new Map<string, MatchProfile>();
    [...availableProfiles, ...eventProfiles].forEach((profile) => profiles.set(getProfileKey(profile), profile));
    return Array.from(profiles.values());
  }, [availableProfiles, eventProfiles]);
  const eventDiscoverProfiles = useMemo(() =>
    eventProfileSource
      .filter((profile) => getProfileKey(profile) !== appUser?.uid)
      .filter((profile) => !blockedProfileKeys.includes(getProfileKey(profile)))
      .filter((profile) => profile.age >= discoverFilters.ageMin && profile.age <= discoverFilters.ageMax)
      .filter((profile) => userAge >= (profile.desiredAgeMin ?? 18) && userAge <= (profile.desiredAgeMax ?? 99))
      .map((profile) => {
        const storedSharedEvents = getSharedActiveEvents(activeEvents, profile.activeEvents ?? []);
        const sharedEvents = storedSharedEvents.length > 0 || !profile.isTestProfile
          ? storedSharedEvents
          : activeEvents.slice(0, 2);
        const ageGap = Math.abs(profile.age - userAge);
        const ageAffinity = ageGap <= 2 ? 28 : ageGap <= 5 ? 20 : ageGap <= 10 ? 12 : 5;
        const eventRank = 200 + sharedEvents.length * 40 + ageAffinity;
        return {
          ...profile,
          sharedEvents,
          distance: "",
          matchScore: eventRank,
          interestMatchPercent: undefined,
          matchReasons: [
            sharedEvents.length > 1 ? String(sharedEvents.length) + " wspólne wydarzenia" : "Wspólne wydarzenie: " + (sharedEvents[0]?.name ?? "Event Friends"),
            String(profile.age) + " lat"
          ],
          eventRank
        };
      })
      .filter((profile) => profile.sharedEvents.length > 0)
      .filter((profile) => {
        const key = getProfileKey(profile);
        return !likedProfileKeys.includes(key) && !passedProfileKeys.includes(key) && !matchedProfileKeys.includes(key) && !chatRequestKeys.includes(key);
      })
      .sort((left, right) => right.eventRank - left.eventRank || (right.matchScore ?? 0) - (left.matchScore ?? 0) || (right.updatedAtMs ?? 0) - (left.updatedAtMs ?? 0)),
    [activeEvents, appUser?.uid, blockedProfileKeys, chatRequestKeys, discoverFilters.ageMax, discoverFilters.ageMin, eventProfileSource, likedProfileKeys, matchedProfileKeys, passedProfileKeys, userAge]
  );
  const currentDiscoverProfiles = discoverMode === "events" ? eventDiscoverProfiles : discoverProfiles;

  useEffect(() => {
    if (
      !releaseConfig.emptyFeedAutoExpand ||
      !discoverFilters.includeProfilesWithoutLocation ||
      discoverMode !== "people" ||
      profilesLoading ||
      profilesLoadingMore ||
      profileFeedError ||
      availableProfiles.length === 0 ||
      discoverProfiles.length > 0 ||
      feedExpansionLevel >= 2
    ) return;

    const timeout = setTimeout(() => {
      setFeedExpansionLevel((current) => current < 2 ? (current + 1) as 0 | 1 | 2 : current);
      trackSparkEvent("feed_auto_expanded", { level: feedExpansionLevel + 1 });
    }, 650);
    return () => clearTimeout(timeout);
  }, [availableProfiles.length, discoverFilters.includeProfilesWithoutLocation, discoverMode, discoverProfiles.length, feedExpansionLevel, profileFeedError, profilesLoading, profilesLoadingMore, releaseConfig.emptyFeedAutoExpand]);

  const activeProfile = currentDiscoverProfiles[0] ?? null;
  const nextProfile = currentDiscoverProfiles[1] ?? null;
  const activeProfileKey = activeProfile ? getProfileKey(activeProfile) : null;
  const hasMatchedActiveProfile = activeProfileKey ? matchedProfileKeys.includes(activeProfileKey) : false;
  const hasRequestedActiveProfile = activeProfileKey ? chatRequestKeys.includes(activeProfileKey) : false;
  const derivedAge = calculateAge(birthDate);
  const identityComplete = profileNameMode === "nickname" ? nickname.trim().length >= 2 : firstName.trim().length >= 2;
  const canContinue = selectedInterests.length >= 3 && identityComplete && derivedAge !== null && derivedAge >= 18 && derivedAge <= 99 && profilePhotos.length >= 1 && profileBio.trim().length >= 20;

  const contentPadding = useMemo(
    () => ({
      paddingTop: authDone && onboarded ? Math.max(insets.top + 4, 12) : Math.max(insets.top + 6, 14),
      paddingBottom: authDone && onboarded ? Math.max(insets.bottom + 94, 106) : Math.max(insets.bottom + 16, 24),
      paddingHorizontal: isCompact ? 14 : 20
    }),
    [authDone, insets.bottom, insets.top, isCompact, onboarded]
  );
  const discoverMinHeight = Math.max(420, height - contentPadding.paddingTop - contentPadding.paddingBottom);

  useEffect(() => {
    setBottomNavHidden(false);
  }, [tab]);

  useEffect(() => {
    if (tab !== "discover" || matchCelebrationProfile || !deferredSwipeAdRef.current) return;
    deferredSwipeAdRef.current = false;
    noteFeedSwipe();
  }, [matchCelebrationProfile, tab, trackSwipeAd]);

  useEffect(() => {
    const openTarget = (target: { route: "matches" | "messages" | "eventFriends"; threadId?: string; eventId?: string }) => {
      if (target.route === "eventFriends") {
        setTab("discover");
        setDiscoverMode("events");
        setEventManagerOpen(true);
        return;
      }
      setTab(target.route);
      if (target.route === "messages" && target.threadId) setPendingNotificationThreadId(target.threadId);
    };
    const unsubscribe = observeSparkNotificationResponses(openTarget);
    void getInitialSparkNotificationRoute().then((target) => {
      if (target) openTarget(target);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!pendingNotificationThreadId) return;
    const target = Object.entries(chatThreads).find(([, thread]) => thread.threadId === pendingNotificationThreadId);
    if (!target) return;
    setSelectedChatKey(target[0]);
    setPendingNotificationThreadId(null);
  }, [chatThreads, pendingNotificationThreadId]);

  useEffect(() => {
    void setSparkAppBadgeCount(messageAttentionCount).catch(() => undefined);
  }, [messageAttentionCount]);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = observeAuthState((user) => {
      void (async () => {
        if (!user) {
          if (mounted) {
            setAppUser(null);
            setProfileVerificationStatus("none");
            setSocialHandles(emptySocialHandles);
            setActiveEvents([]);
            setEventProfiles([]);
            setDiscoverMode("people");
            setAuthDone(false);
            setOnboarded(false);
            setAuthRestoring(false);
          }
          return;
        }

        try {
          const [profile, privateSettings] = await Promise.all([getUserProfile(user.uid), getUserPrivateSettings(user.uid)]);
          if (profile?.moderationStatus === "suspended") {
            throw new Error("Twoje konto zosta\u0142o zawieszone. Skontaktuj si\u0119 z zespo\u0142em Spark, je\u015bli uwa\u017casz, \u017ce to pomy\u0142ka.");
          }
          if (profile) {
            const verification = await syncProfileVerification().catch(() => ({ status: profile.verificationStatus === "verified" ? "verified" as const : "none" as const }));
            if (mounted) setProfileVerificationStatus(verification.status);
            const storedEvents = Array.isArray(profile.activeEvents) ? profile.activeEvents : [];
            const currentEvents = sanitizeActiveEvents(storedEvents);
            const eventsNeedRefresh = storedEvents.length !== currentEvents.length
              || currentEvents.some((event, index) => (storedEvents[index] as Partial<SparkEvent> | undefined)?.id !== event.id);
            if (eventsNeedRefresh) {
              await updateUserActiveEvents(user.uid, currentEvents).catch(() => syncPublicUserProfile(user.uid).catch(() => undefined));
            } else {
              await syncPublicUserProfile(user.uid).catch(() => undefined);
            }
          }

          if (!mounted) {
            return;
          }

          setAppUser(user);
          setEmail(user.email ?? "");

          if (profile) {
            setFirstName(repairLegacyText(profile.firstName ?? ""));
            setLastName(repairLegacyText(profile.lastName ?? ""));
            setProfileNameMode(profile.profileNameMode ?? "realName");
            setNickname(repairLegacyText(profile.nickname ?? ""));
            setGender(normalizeProfileGender(profile.gender));
            setBirthDate(privateSettings?.birthDate ?? "");
            const storedIntents = normalizeSparkIntents(profile.intents, profile.intent);
            const loadedIntents = storedIntents.filter((value) => value !== "LGBT+ / Społeczność");
            // Someone who only had the old LGBT+ goal was looking for people, not dates by default.
            const nextIntents: SparkIntent[] = loadedIntents.length ? loadedIntents : storedIntents.length ? ["Znajomi"] : ["Randki"];
            setIntents(nextIntents);
            setProfileBio(typeof profile.bio === "string" && profile.bio.trim().length >= 20 ? profile.bio.trim().slice(0, 300) : "Poznajmy si\u0119 przez wsp\u00f3lne zainteresowania i dobr\u0105 rozmow\u0119.");
            setAgeBand(profile.ageBand ?? null);
            setUserAge(privateSettings?.birthDate ? calculateAge(privateSettings.birthDate) ?? profile.age ?? 18 : profile.age ?? 18);
            setUserCity(profile.city ?? "");
            setUserCountry(profile.country ?? "");
            setUserCountryCode(typeof profile.countryCode === "string" && /^[A-Z]{2}$/.test(profile.countryCode) ? profile.countryCode : getDeviceCountryCode() ?? "");
            setDiscoverFilters((current) => ({ ...current, ageMin: profile.desiredAgeMin ?? current.ageMin, ageMax: profile.desiredAgeMax ?? current.ageMax, maxDistanceKm: profile.maxDistanceKm ?? current.maxDistanceKm, targetInterests: Array.isArray(profile.desiredInterests) ? profile.desiredInterests : current.targetInterests, targetIntents: normalizeSparkIntents(profile.desiredIntents).length ? normalizeSparkIntents(profile.desiredIntents) : nextIntents, targetGendersByIntent: normalizeGenderPreferences(profile.desiredGendersByIntent), requireCommonInterests: Boolean(profile.requireCommonInterests), includeProfilesWithoutLocation: profile.includeProfilesWithoutLocation !== false, proOnly: Boolean(profile.proOnly), lgbtOnly: profile.lgbtOnly === true }));
            setLgbt(profile.lgbt ?? null);
            lgbtSaved.current = profile.lgbt ?? null;
            setSelectedInterests(Array.isArray(profile.interests) ? profile.interests.map(repairLegacyText) : []);
            const storedEvents = Array.isArray(profile.activeEvents) ? profile.activeEvents : [];
            const currentEvents = sanitizeActiveEvents(storedEvents);
            setActiveEvents(currentEvents);
            setExpiredEventsCount(Math.max(0, storedEvents.length - currentEvents.length));
            setProfilePhotos(Array.isArray(profile.photoUrls) ? profile.photoUrls : []);
            setSocialHandles(getSocialHandles(profile.socials));

            setOnboarded(Boolean(profile.onboardingComplete) || ((profile.interests?.length ?? 0) >= 3 && Boolean(profile.ageBand)));
          } else {
            setSocialHandles(emptySocialHandles);
            setActiveEvents([]);
            setExpiredEventsCount(0);
            setOnboarded(false);
          }

          setAuthDone(true);
        } catch (error) {
          await signOutUser().catch(() => undefined);
          if (mounted) {
            setAppUser(null);
            setAuthError(error instanceof Error ? error.message : "Nie uda\u0142o si\u0119 przywr\u00f3ci\u0107 profilu. Zaloguj si\u0119 ponownie.");
            setAuthDone(false);
            setOnboarded(false);
          }
        } finally {
          if (mounted) {
            setAuthRestoring(false);
          }
        }
      })();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || !isGoogleSignInConfigured) return;

    GoogleSignin.configure({
      webClientId: googleClientIds.webClientId,
      iosClientId: googleClientIds.iosClientId,
      offlineAccess: false
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AppleAuthentication.isAvailableAsync()
      .then(setAppleSignInAvailable)
      .catch(() => setAppleSignInAvailable(false));
  }, []);

  async function updateCurrentLocation(requestPermission: boolean) {
    if (locationBusy) return false;
    setLocationBusy(true);

    try {
      const permission = requestPermission
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationStatus(permission.status === Location.PermissionStatus.DENIED ? "denied" : "idle");
        if (requestPermission) {
          Alert.alert(
            "Lokalizacja jest opcjonalna",
            "Mo\u017cesz korzysta\u0107 ze Spark bez lokalizacji. Aby pokazywa\u0107 przybli\u017con\u0105 odleg\u0142o\u015b\u0107, w\u0142\u0105cz dost\u0119p w ustawieniach.",
            [
              { text: "Nie teraz", style: "cancel" },
              { text: "Otw\u00f3rz ustawienia", onPress: () => { void Linking.openSettings(); } }
            ]
          );
        }
        return false;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      let place: Location.LocationGeocodedAddress | undefined;
      try {
        place = (await Location.reverseGeocodeAsync(coordinates))[0];
      } catch {
        place = undefined;
      }

      setLocationStatus("granted");
      setUserLocation(coordinates);
      setUserCity(place?.city || place?.subregion || place?.region || "");
      setUserCountry(place?.country || "");
      if (place?.isoCountryCode && /^[A-Za-z]{2}$/.test(place.isoCountryCode)) setUserCountryCode(place.isoCountryCode.toUpperCase());
      return true;
    } catch {
      setLocationStatus("denied");
      if (requestPermission) {
        Alert.alert("Lokalizacja", "Nie uda\u0142o si\u0119 pobra\u0107 lokalizacji. Spr\u00f3buj ponownie lub sprawd\u017a ustawienia Spark.");
      }
      return false;
    } finally {
      setLocationBusy(false);
    }
  }

  useEffect(() => {
    if (!authDone || userLocation) return;
    void updateCurrentLocation(false);
  }, [authDone, userLocation]);

  // Push texts are rendered server-side in the device's app language.
  const appLanguage = useLanguage();
  useEffect(() => {
    if (!appUser?.uid) return;
    void updateDeviceLanguage(appUser.uid).catch(() => undefined);
  }, [appLanguage, appUser?.uid]);

  useEffect(() => {
    if (!authDone || !onboarded || !appUser) return;
    let mounted = true;
    let promptTimer: ReturnType<typeof setTimeout> | null = null;
    const promptKey = "spark_push_prompt_" + appUser.uid;

    void AsyncStorage.getItem(promptKey).then((choice) => {
      if (!mounted) return;
      if (choice === "enabled") {
        void registerSparkPushNotifications(appUser.uid).catch(() => undefined);
        return;
      }
      if (choice) return;

      promptTimer = setTimeout(() => {
        Alert.alert(
          "Nie przegap nowego matchu",
          "Włącz powiadomienia o matchach, prośbach i nowych wiadomościach. Możesz je później wyłączyć w ustawieniach telefonu.",
          [
            { text: "Później", style: "cancel", onPress: () => { void AsyncStorage.setItem(promptKey, "later"); } },
            {
              text: "Włącz",
              onPress: () => {
                void registerSparkPushNotifications(appUser.uid)
                  .then((enabled) => AsyncStorage.setItem(promptKey, enabled ? "enabled" : "denied"))
                  .catch(() => AsyncStorage.setItem(promptKey, "error"));
              }
            }
          ]
        );
      }, 1200);
    });

    return () => {
      mounted = false;
      if (promptTimer) clearTimeout(promptTimer);
    };
  }, [appUser, authDone, onboarded]);

  useEffect(() => {
    if (!authDone || !onboarded || !appUser || selectedInterests.length === 0) {
      return;
    }

    let mounted = true;
    setProfilesLoading(true);
    setProfileCursor(null);
    setProfilesHaveMore(false);
    setProfileFeedError(null);

    Promise.allSettled([
      findProfilesByInterest(profileLookupInterests, null, activeLensIntents, userCity),
      canViewTestProfiles ? findTestProfiles() : Promise.resolve([]),
      findOutgoingProfileSwipes(appUser.uid),
      canViewTestProfiles ? findMatchThreadsForUser(appUser.uid) : Promise.resolve([])
    ])
      .then(([profilesResult, testProfilesResult, swipesResult, matchesResult]) => {
        if (!mounted) {
          return;
        }

        const profileDocuments = profilesResult.status === "fulfilled" ? profilesResult.value.profiles : [];
        const testProfileDocuments = testProfilesResult.status === "fulfilled" ? testProfilesResult.value : [];
        const swipeDocuments = swipesResult.status === "fulfilled" ? swipesResult.value : [];
        const matchDocuments = matchesResult.status === "fulfilled" ? matchesResult.value : [];

        if (profilesResult.status === "rejected") {
          setRemoteProfiles([]);
          setProfileFeedError("Nie udało się pobrać profili. Spróbuj odświeżyć listę.");
          return;
        }

        setProfileFeedError(null);
        if (profilesResult.status === "fulfilled") {
          setProfileCursor(profilesResult.value.nextCursor);
          setProfilesHaveMore(profilesResult.value.hasMore);
        }

        const profileMap = new Map<string, Record<string, unknown>>();
        [...profileDocuments, ...testProfileDocuments].forEach((item) => {
          if (item.id !== appUser.uid && (canViewTestProfiles || item.isTestProfile !== true)) {
            profileMap.set(String(item.id), item as Record<string, unknown>);
          }
        });
        const mappedProfiles = Array.from(profileMap.values())
          .map((item) => mapRemoteProfile(item))
          .filter((profile): profile is MatchProfile => Boolean(profile));
        const likedKeys = swipeDocuments
          .filter((item) => item.status === "liked")
          .map((item) => String(item.toProfileKey));
        const passedKeys = swipeDocuments
          .filter((item) => item.status === "passed")
          .map((item) => String(item.toProfileKey));
        const matchedKeys = matchDocuments
          .filter((item) => item.status === "matched")
          .flatMap((item) => Array.isArray(item.memberUids) ? item.memberUids.filter((uid): uid is string => typeof uid === "string" && uid !== appUser.uid) : []);
        const requestedKeys = matchDocuments
          .filter((item) => item.status === "requested")
          .flatMap((item) => Array.isArray(item.memberUids) ? item.memberUids.filter((uid): uid is string => typeof uid === "string" && uid !== appUser.uid) : []);

        const resetTimes = [...swipeDocuments, ...matchDocuments]
          .map((item) => item.resetAtMs)
          .filter((value): value is number => typeof value === "number" && value > Date.now());
        setNextTestResetAt(resetTimes.length > 0 ? Math.min(...resetTimes) : null);
        setRemoteProfiles(mappedProfiles);
        setLikedProfileKeys((keys) => Array.from(new Set([...keys.filter((key) => !isDailyTestProfileKey(key)), ...likedKeys.filter((key) => !matchedKeys.includes(key))])));
        setPassedProfileKeys((keys) => Array.from(new Set([...keys.filter((key) => !isDailyTestProfileKey(key)), ...passedKeys])));
        setMatchedProfileKeys((keys) => Array.from(new Set([...keys.filter((key) => !isDailyTestProfileKey(key)), ...matchedKeys])));
        setChatRequestKeys((keys) => Array.from(new Set([...keys.filter((key) => !isDailyTestProfileKey(key)), ...requestedKeys])));
        setChatThreads((threads) => {
          const nextThreads = { ...threads };
          matchedKeys.forEach((profileKey) => {
            nextThreads[profileKey] = nextThreads[profileKey] ?? { profileKey, status: "matched", messages: [] };
          });
          return nextThreads;
        });
      })
      .catch((error) => {
        if (mounted) {
          setRemoteProfiles([]);
          setProfileFeedError(error instanceof Error ? error.message : "Nie udało się pobrać profili.");
        }
      })
      .finally(() => {
        if (mounted) {
          setProfilesLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [appUser, authDone, canViewTestProfiles, onboarded, profileQueryKey, profileReloadKey]);

  useEffect(() => {
    if (!appUser || !authDone || !onboarded) {
      setSparkEvents([]);
      setSparkEventsLoading(false);
      setSparkEventsError(null);
      return;
    }

    setSparkEventsLoading(true);
    setSparkEventsError(null);
    const unsubscribe = observeSparkEvents(
      (catalogEvents, catalogDetails) => {
        setSparkEvents(catalogEvents);
        setSparkEventDetails(catalogDetails);
        setSparkEventsLoading(false);
        setActiveEvents((current) => {
          const catalogIds = new Set(catalogEvents.map((event) => event.id));
          const reconciled = sanitizeActiveEvents(current).filter((event) => catalogIds.has(event.id));
          if (reconciled.length !== current.length) {
            void updateUserActiveEvents(appUser.uid, reconciled).catch(() => undefined);
          }
          return reconciled;
        });
      },
      () => {
        setSparkEventsLoading(false);
        setSparkEventsError("Nie udało się pobrać aktualnych wydarzeń.");
      }
    );
    return unsubscribe;
  }, [appUser, authDone, onboarded, eventCatalogReload]);

  useEffect(() => {
    if (!appUser || !authDone || !onboarded || activeEvents.length === 0) {
      setEventProfiles([]);
      setEventProfilesLoading(false);
      setEventProfilesError(null);
      return;
    }

    let mounted = true;
    setEventProfilesLoading(true);
    setEventProfilesError(null);
    void findProfilesByActiveEvents(activeEvents.map((event) => event.id))
      .then((documents) => {
        if (!mounted) return;
        const profiles = documents
          .filter((item) => item.id !== appUser.uid && (canViewTestProfiles || (item as Record<string, unknown>).isTestProfile !== true))
          .map((item) => mapRemoteProfile(item as Record<string, unknown>))
          .filter((profile): profile is MatchProfile => Boolean(profile));
        setEventProfiles(profiles);
      })
      .catch(() => {
        if (!mounted) return;
        setEventProfiles([]);
        setEventProfilesError("Nie udało się pobrać profili z tych wydarzeń.");
      })
      .finally(() => {
        if (mounted) setEventProfilesLoading(false);
      });

    return () => { mounted = false; };
  }, [activeEventIdsKey, appUser, authDone, canViewTestProfiles, onboarded, profileReloadKey]);

  useEffect(() => {
    if (!appUser || !authDone || !onboarded || !profilesHaveMore || !profileCursor || profilesLoading || profilesLoadingMore || discoverProfiles.length > 6) return;
    let mounted = true;
    setProfilesLoadingMore(true);
    void findProfilesByInterest(profileLookupInterests, profileCursor, activeLensIntents, userCity)
      .then((page) => {
        if (!mounted) return;
        const nextProfiles = page.profiles
          .filter((item) => item.id !== appUser.uid && (canViewTestProfiles || item.isTestProfile !== true))
          .map((item) => mapRemoteProfile(item as Record<string, unknown>))
          .filter((profile): profile is MatchProfile => Boolean(profile));
        setRemoteProfiles((current) => {
          const profileMap = new Map(current.map((profile) => [getProfileKey(profile), profile]));
          nextProfiles.forEach((profile) => profileMap.set(getProfileKey(profile), profile));
          return Array.from(profileMap.values());
        });
        setProfileCursor(page.nextCursor);
        setProfilesHaveMore(page.hasMore);
      })
      .catch(() => {
        if (mounted) setProfilesHaveMore(false);
      })
      .finally(() => {
        if (mounted) setProfilesLoadingMore(false);
      });
    return () => { mounted = false; };
  }, [appUser, authDone, canViewTestProfiles, discoverProfiles.length, onboarded, profileCursor, profileQueryKey, profilesHaveMore, profilesLoading, profilesLoadingMore]);

  useEffect(() => {
    if (!appUser || !authDone || !onboarded || !revenueCat.isPro || tab !== "matches") {
      setIncomingLikeKinds({});
      return undefined;
    }

    let mounted = true;
    void findIncomingProfileLikes(appUser.uid)
      .then(async (likes) => {
        const uniqueLikes = Array.from(new Map(likes.map((like) => [like.fromUid, like])).values());
        const documents = await getPublicProfiles(uniqueLikes.map((like) => like.fromUid));
        if (!mounted) return;

        setIncomingLikeKinds(Object.fromEntries(uniqueLikes.map((like) => [like.fromUid, like.direction])));
        const profiles = documents
          .map((document) => document ? mapRemoteProfile(document as Record<string, unknown>) : null)
          .filter((profile): profile is MatchProfile => Boolean(profile));
        setRemoteProfiles((current) => {
          const profileMap = new Map(current.map((profile) => [getProfileKey(profile), profile]));
          profiles.forEach((profile) => profileMap.set(getProfileKey(profile), profile));
          return Array.from(profileMap.values());
        });
      })
      .catch(() => {
        if (mounted) setIncomingLikeKinds({});
      });

    return () => {
      mounted = false;
    };
  }, [appUser, authDone, onboarded, profileReloadKey, revenueCat.isPro, tab]);

  useEffect(() => {
    if (!appUser || !authDone || !onboarded) return undefined;

    const unsubscribeChats = observeUserChats(appUser.uid, (realtimeThreads) => {
      const nextThreads: Record<string, ChatThread> = {};
      const matchedKeys: string[] = [];
      const requestedKeys: string[] = [];

      realtimeThreads.forEach((thread) => {
        const profileKey = thread.memberUids.find((uid) => uid !== appUser.uid);
        if (!profileKey) return;
        if (thread.status === "matched") matchedKeys.push(profileKey);
        if (thread.status === "requested") requestedKeys.push(profileKey);
        nextThreads[profileKey] = {
          profileKey,
          threadId: thread.id,
          createdByUid: thread.createdByUid,
          createdAtMs: thread.createdAtMs,
          requestDirection: thread.createdByUid === appUser.uid ? "outgoing" : "incoming",
          status: thread.status,
          introMessage: thread.introMessage,
          eventContext: thread.eventContext,
          modeContext: thread.modeContext,
          unreadCount: thread.unreadCount,
          lastMessageText: thread.lastMessageText,
          lastMessageAtMs: thread.lastMessageAtMs,
          messages: []
        };
      });

      setChatThreads((current) => Object.fromEntries(Object.entries(nextThreads).map(([profileKey, thread]) => [
        profileKey,
        {
          ...thread,
          messages: current[profileKey]?.messages ?? [],
          lastMessageText: thread.lastMessageText ?? current[profileKey]?.lastMessageText,
          lastMessageAtMs: thread.lastMessageAtMs ?? current[profileKey]?.lastMessageAtMs
        }
      ])));
      setMatchedProfileKeys(matchedKeys);
      setChatRequestKeys(requestedKeys);

      const conversationProfileKeys = Array.from(new Set([...matchedKeys, ...requestedKeys]));
      void getPublicProfiles(conversationProfileKeys).then((documents) => {
        const profiles = documents.map((document) => document ? mapRemoteProfile(document as Record<string, unknown>) : null).filter((profile): profile is MatchProfile => Boolean(profile));
        setRemoteProfiles((current) => {
          const profileMap = new Map(current.map((profile) => [getProfileKey(profile), profile]));
          profiles.forEach((profile) => profileMap.set(getProfileKey(profile), profile));
          return Array.from(profileMap.values());
        });
      }).catch(() => undefined);
    }, (error) => setProfileFeedError(error.message));
    const unsubscribeBlocks = observeBlockedProfileKeys(appUser.uid, setBlockedProfileKeys, (error) => setProfileFeedError(error.message));
    return () => { unsubscribeChats(); unsubscribeBlocks(); };
  }, [appUser, authDone, onboarded]);

  useEffect(() => {
    if (!appUser || tab !== "messages" || !selectedChatKey || !selectedChatThreadId) return undefined;
    return observeChatMessages(
      selectedChatThreadId,
      (messages) => {
        setChatThreads((current) => current[selectedChatKey] ? {
          ...current,
          [selectedChatKey]: {
            ...current[selectedChatKey],
            messages: messages.map((message) => ({
              id: message.id,
              from: message.senderUid === appUser.uid ? "me" : "them",
              text: message.text,
              time: message.createdAtMs ? formatTime(message.createdAtMs) : "teraz"
            }))
          }
        } : current);
      },
      (error) => setProfileFeedError(error.message)
    );
  }, [appUser, selectedChatKey, selectedChatThreadId, tab]);

  useEffect(() => {
    if (!appUser || tab !== "messages" || !selectedChatKey) return;
    const thread = chatThreads[selectedChatKey];
    const unreadCount = Math.max(0, thread?.unreadCount ?? 0);
    if (!thread?.threadId || unreadCount === 0 || markingReadThreadIdsRef.current.has(thread.threadId)) return;

    const threadId = thread.threadId;
    markingReadThreadIdsRef.current.add(threadId);
    setChatThreads((current) => ({ ...current, [selectedChatKey]: { ...current[selectedChatKey], unreadCount: 0 } }));
    void markChatThreadRead({ threadId, uid: appUser.uid })
      .catch(() => {
        setChatThreads((current) => current[selectedChatKey]
          ? { ...current, [selectedChatKey]: { ...current[selectedChatKey], unreadCount: Math.max(current[selectedChatKey].unreadCount ?? 0, unreadCount) } }
          : current);
      })
      .finally(() => markingReadThreadIdsRef.current.delete(threadId));
  }, [appUser, chatThreads, selectedChatKey, tab]);

  useEffect(() => {
    if (!appUser || !onboarded || revenueCat.isLoading || !revenueCat.configured) return undefined;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const syncVerifiedPro = async (attempt: number) => {
      try {
        const claims = await getRevenueCatEntitlements(true);
        if (cancelled) return;
        const claimIsPro = ownerProAccess || claims.includes(revenueCatEntitlementId);

        if (claimIsPro || !revenueCat.isPro) {
          await syncPublicUserProfile(appUser.uid, claimIsPro);
          if (!cancelled) setProfileReloadKey((value) => value + 1);
          return;
        }

        if (attempt < 7) {
          retryTimer = setTimeout(() => void syncVerifiedPro(attempt + 1), Math.min(30000, 5000 * (attempt + 1)));
        }
      } catch {
        if (!cancelled && attempt < 7) {
          retryTimer = setTimeout(() => void syncVerifiedPro(attempt + 1), Math.min(30000, 5000 * (attempt + 1)));
        }
      }
    };

    void syncVerifiedPro(0);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [appUser, onboarded, ownerProAccess, revenueCat.configured, revenueCat.isLoading, revenueCat.isPro]);

  useEffect(() => {
    if (!appUser || !revenueCat.isPro) {
      setSuperlikesRemaining(10);
      return;
    }

    let mounted = true;
    void getMonthlySuperlikeUsage(appUser.uid)
      .then((used) => {
        if (mounted) setSuperlikesRemaining(Math.max(0, 10 - used));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [appUser, revenueCat.isPro]);

  useEffect(() => {
    if (!appUser || !revenueCat.isPro || tab !== "profile") {
      setProfileViewers([]);
      setProfileViewerCount(0);
      setProfileViewersLoading(false);
      return undefined;
    }

    let active = true;
    setProfileViewersLoading(true);
    const unsubscribe = observeRecentProfileViews(
      appUser.uid,
      (views) => {
        setProfileViewerCount(views.length);
        void getPublicProfiles(views.map((view) => view.viewerUid))
          .then((documents) => {
            if (!active) return;
            const profiles = documents.reduce<MatchProfile[]>((items, document, index) => {
              const profile = document ? mapRemoteProfile(document as Record<string, unknown>) : null;
              if (profile) {
                items.push({
                  ...profile,
                  profileViewCount: views[index]?.viewCount ?? 1,
                  profileLastViewedAtMs: views[index]?.lastViewedAtMs ?? null
                });
              }
              return items;
            }, []);
            setProfileViewers(profiles);
            setProfileViewersLoading(false);
          })
          .catch(() => {
            if (active) setProfileViewersLoading(false);
          });
      },
      () => {
        if (active) {
          setProfileViewers([]);
          setProfileViewerCount(0);
          setProfileViewersLoading(false);
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [appUser, profileReloadKey, revenueCat.isPro, tab]);

  useEffect(() => {
    if (!nextTestResetAt) return undefined;

    const timeout = setTimeout(() => {
      setLikedProfileKeys((keys) => keys.filter((key) => !isDailyTestProfileKey(key)));
      setPassedProfileKeys((keys) => keys.filter((key) => !isDailyTestProfileKey(key)));
      setMatchedProfileKeys((keys) => keys.filter((key) => !isDailyTestProfileKey(key)));
      setChatRequestKeys((keys) => keys.filter((key) => !isDailyTestProfileKey(key)));
      setChatThreads((threads) => Object.fromEntries(Object.entries(threads).filter(([key]) => !isDailyTestProfileKey(key))));
      setNextTestResetAt(null);
      setProfileReloadKey((value) => value + 1);
    }, Math.max(1000, nextTestResetAt - Date.now() + 1000));

    return () => clearTimeout(timeout);
  }, [nextTestResetAt]);

  function seedDemoMatchState() {
    const matchedKey = getProfileKey(matchProfiles[0]);
    const requestKey = getProfileKey(matchProfiles[3]);

    setMatchedProfileKeys((keys) => (keys.includes(matchedKey) ? keys : [...keys, matchedKey]));
    setChatRequestKeys((keys) => (keys.includes(requestKey) ? keys : [...keys, requestKey]));
    setSelectedChatKey(matchedKey);
    setChatThreads((threads) => ({
      ...threads,
      [matchedKey]: threads[matchedKey] ?? {
        profileKey: matchedKey,
        status: "matched",
        messages: [
          { id: "demo-1", from: "them", text: "Hej, mamy match. Kawa albo spacer?", time: "teraz" }
        ]
      },
      [requestKey]: threads[requestKey] ?? {
        profileKey: requestKey,
        status: "requested",
        introMessage: "Hej, widzę wspólne klimaty. Masz ochotę pogadać?",
        messages: []
      }
    }));
    setSelectedInterests(["Filmy", "Natura", "Kawa", "Sztuka"]);
    setAgeBand("18+");
    setOnboarded(true);
    setTab("messages");
  }

  async function handleGoogleSignIn() {
    setAuthBusy(true);
    setAuthError(null);
    let authenticated = false;

    try {
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const response = await GoogleSignin.signIn();
      if (response.type !== "success") return;

      const idToken = response.data.idToken;
      if (!idToken) throw new Error("Google nie zwr\u00f3ci\u0142 tokenu logowania.");

      setAuthRestoring(true);
      const user = await signInWithGoogleIdToken(idToken);
      authenticated = true;
      setEmail(user.email ?? "");

      await recordUserLogin({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        authProvider: "google",
        fallbackFirstName: response.data.user.givenName ?? "",
        fallbackLastName: response.data.user.familyName ?? ""
      }).catch(() => undefined);
      // observeAuthState restores the existing profile before advancing the UI.
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Nie uda\u0142o si\u0119 zalogowa\u0107 przez Google.");
    } finally {
      setAuthBusy(false);
      if (!authenticated) {
        setAuthRestoring(false);
      }
    }
  }

  async function handleAppleSignIn() {
    setAuthBusy(true);
    setAuthError(null);
    let authenticated = false;

    try {
      if (Platform.OS !== "ios") {
        throw new Error("Logowanie Apple jest dost\u0119pne na iPhonie.");
      }

      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      const response = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ],
        nonce: hashedNonce
      });

      if (!response.identityToken) {
        throw new Error("Apple nie zwr\u00f3ci\u0142 tokenu logowania.");
      }

      const displayName = [
        response.fullName?.givenName,
        response.fullName?.familyName
      ].filter(Boolean).join(" ");

      setAuthRestoring(true);
      const user = await signInWithAppleIdToken({
        idToken: response.identityToken,
        rawNonce,
        displayName
      });
      authenticated = true;
      setEmail(user.email ?? response.email ?? "");

      await recordUserLogin({
        uid: user.uid,
        email: user.email ?? response.email,
        displayName: user.displayName || displayName || null,
        authProvider: "apple",
        fallbackFirstName: response.fullName?.givenName ?? "",
        fallbackLastName: response.fullName?.familyName ?? ""
      }).catch(() => undefined);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
      if (code !== "ERR_REQUEST_CANCELED") {
        setAuthError(error instanceof Error ? error.message : "Nie uda\u0142o si\u0119 zalogowa\u0107 przez Apple.");
      }
    } finally {
      setAuthBusy(false);
      if (!authenticated) setAuthRestoring(false);
    }
  }

  async function handleEmailAuth() {
    setAuthBusy(true);
    setAuthError(null);
    let authenticated = false;

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
        setAuthError("Podaj prawid\u0142owy adres email.");
        return;
      }

      if (authMode === "register" && password.length < 8) {
        setAuthError("Has\u0142o musi mie\u0107 co najmniej 8 znaków.");
        return;
      }

      if (authMode === "register" && password !== confirmPassword) {
        setAuthError("Has\u0142a nie s\u0105 takie same.");
        return;
      }

      setAuthRestoring(true);
      const user =
        authMode === "register"
          ? await signUpWithEmail({ email: normalizedEmail, password, firstName: "", lastName: "" })
          : await signInWithEmail(normalizedEmail, password);
      authenticated = true;
      setEmail(normalizedEmail);

      await recordUserLogin({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        authProvider: "email",
        fallbackFirstName: firstName,
        fallbackLastName: lastName
      }).catch(() => undefined);
      // observeAuthState restores the existing profile before advancing the UI.
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Nie uda\u0142o si\u0119 zalogowa\u0107.");
    } finally {
      setAuthBusy(false);
      if (!authenticated) {
        setAuthRestoring(false);
      }
    }
  }
  async function handlePasswordReset() {
    setAuthError(null);
    try {
      await requestPasswordReset(email);
      Alert.alert("Sprawdź pocztę", "Wysłaliśmy link do ustawienia nowego hasła.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Nie udało się wysłać linku resetującego.");
    }
  }
  async function saveProfileToFirestore() {
    if (!appUser) {
      return false;
    }

    const calculatedAge = calculateAge(birthDate);
    const hasValidIdentity = profileNameMode === "nickname"
      ? nickname.trim().length >= 2
      : firstName.trim().length >= 2;
    if (!hasValidIdentity || calculatedAge === null || calculatedAge < 18 || calculatedAge > 99 || selectedInterests.length < 3 || profilePhotos.length < 1 || profileBio.trim().length < 20) {
      Alert.alert("Profil", "Uzupełnij nazwę, opis (minimum 20 znaków), prawidłową datę urodzenia, zdjęcie i co najmniej 3 zainteresowania.");
      return false;
    }

    try {
      const existingProfile = await getUserProfile(appUser.uid);
      const previousPhotoUrls = Array.isArray(existingProfile?.photoUrls) ? existingProfile.photoUrls : [];
      const persistedPhotos = await uploadProfilePhotos(appUser.uid, profilePhotos);
      setProfilePhotos(persistedPhotos);
      setUserAge(calculatedAge);
      setAgeBand("18+");
      await upsertUserProfile({
        uid: appUser.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        profileNameMode,
        nickname: nickname.trim(),
        gender,
        email: appUser.email ?? email,
        intent: intents[0] ?? "Randki",
        intents,
        bio: profileBio.trim().slice(0, 300),
        ageBand: "18+",
        age: calculatedAge,
        interests: selectedInterests,
        activeEvents,
        activeEventIds: activeEvents.map((event) => event.id),
        photoUrls: persistedPhotos,
        mainPhotoUrl: persistedPhotos[0] ?? null,
        desiredAgeMin: discoverFilters.ageMin,
        desiredAgeMax: discoverFilters.ageMax,
        maxDistanceKm: discoverFilters.maxDistanceKm,
        desiredInterests: discoverFilters.targetInterests,
        desiredIntents: discoverFilters.targetIntents.length ? discoverFilters.targetIntents : intents,
        desiredGendersByIntent: discoverFilters.targetGendersByIntent,
        requireCommonInterests: discoverFilters.requireCommonInterests,
        proOnly: discoverFilters.proOnly,
        includeProfilesWithoutLocation: discoverFilters.includeProfilesWithoutLocation,
        city: userCity,
        country: userCountry,
        ...(userCountryCode ? { countryCode: userCountryCode } : {}),
        location: getApproximatePublicLocation(userLocation),
        privateProfile: false,
        onboardingComplete: true,
        socials: socialHandlesToRecord(socialHandles)
      });
      const verification = await syncProfileVerification().catch(() => ({ status: profileVerificationStatus }));
      setProfileVerificationStatus(verification.status);
      await upsertUserPrivateSettings(appUser.uid, { birthDate });

      const removedPhotoUrls = previousPhotoUrls.filter((url) => !persistedPhotos.includes(url));
      if (removedPhotoUrls.length > 0) {
        await deleteProfilePhotos(appUser.uid, removedPhotoUrls).catch(() => undefined);
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się zapisać profilu.";
      setAuthError(message);
      Alert.alert("Profil", message);
      return false;
    }
  }

  async function saveDiscoveryPreferences(nextFilters: DiscoverFilters): Promise<boolean> {
    if (!appUser) {
      return false;
    }

    try {
      await updateUserDiscoveryPreferences(appUser.uid, {
        desiredAgeMin: nextFilters.ageMin,
        desiredAgeMax: nextFilters.ageMax,
        maxDistanceKm: nextFilters.maxDistanceKm,
        desiredInterests: nextFilters.targetInterests,
        desiredIntents: nextFilters.targetIntents,
        desiredGendersByIntent: nextFilters.targetGendersByIntent,
        requireCommonInterests: nextFilters.requireCommonInterests,
        proOnly: nextFilters.proOnly,
        includeProfilesWithoutLocation: nextFilters.includeProfilesWithoutLocation,
        lgbtOnly: nextFilters.lgbtOnly
      });
      setDiscoverFilters(nextFilters);
      setFeedExpansionLevel(0);
      trackSparkEvent("discovery_preferences_saved", {
        age_min: nextFilters.ageMin,
        age_max: nextFilters.ageMax,
        max_distance_km: nextFilters.maxDistanceKm,
        intents_count: nextFilters.targetIntents.length,
        interests_count: nextFilters.targetInterests.length
      });
      setProfileReloadKey((value) => value + 1);
      return true;
    } catch {
      Alert.alert("Preferencje", "Nie uda\u0142o si\u0119 zapisa\u0107 preferencji. Spr\u00f3buj ponownie.");
      return false;
    }
  }

  async function saveActiveEvents(nextEvents: SparkEvent[]): Promise<boolean> {
    if (!appUser) return false;
    const sanitized = sanitizeActiveEvents(nextEvents);
    try {
      const savedEvents = await updateUserActiveEvents(appUser.uid, sanitized);
      setActiveEvents(savedEvents);
      setExpiredEventsCount(0);
      setEventProfilesError(null);
      setProfileReloadKey((value) => value + 1);
      return true;
    } catch {
      Alert.alert("Event Friends", "Nie udało się zapisać wydarzeń. Sprawdź połączenie i spróbuj ponownie.");
      return false;
    }
  }

  async function handleDemoAccount() {
    setAuthBusy(true);
    setAuthError(null);
    setAuthMode("login");
    setFirstName(demoAccount.firstName);
    setLastName(demoAccount.lastName);
    setEmail(demoAccount.email);
    setPassword(demoAccount.password);
    setConfirmPassword(demoAccount.password);

    try {
      let user: AppAuthUser;

      try {
        user = await signInWithEmail(demoAccount.email, demoAccount.password);
      } catch {
        user = await signUpWithEmail(demoAccount);
      }

      await recordUserLogin({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        authProvider: "demo",
        fallbackFirstName: demoAccount.firstName,
        fallbackLastName: demoAccount.lastName
      });

      setAppUser(user);
      setAuthDone(true);
      seedDemoMatchState();
      Alert.alert("Konto testowe", "Zalogowano demo i dodano gotowy match oraz prośbę o chat.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not open demo account.");
    } finally {
      setAuthBusy(false);
    }
  }

  function changeDiscoverMode(next: DeckMode) {
    tap();
    if (next === "event") {
      setDiscoverMode("events");
      if (activeEvents.length === 0) setEventManagerOpen(true);
      trackSparkEvent("discover_mode_changed", { mode: "event" });
      return;
    }
    setDiscoverMode("people");
    if (next !== discoverLens || discoverFilters.targetIntents.join("|") !== lensIntentsFor(next).join("|")) {
      // Switch right away; saving only remembers the choice for next time.
      const targetIntents = lensIntentsFor(next);
      setDiscoverFilters((current) => ({ ...current, targetIntents }));
      setFeedExpansionLevel(0);
      setProfileReloadKey((value) => value + 1);
      if (appUser) void updateUserDiscoveryLens(appUser.uid, targetIntents).catch((error) => recordSparkError(error, "discover_lens_save"));
    }
    trackSparkEvent("discover_mode_changed", { mode: next });
    const ownGoalMissing = next === "romantic" ? !intents.includes("Randki") : !intents.includes("Znajomi") && !intents.includes("LGBT+ / Społeczność");
    if (ownGoalMissing) {
      Alert.alert(
        next === "romantic" ? "Romantic" : "Friends",
        next === "romantic"
          ? "W Twoim profilu nie ma celu „Randki”. Możesz przeglądać, ale osoby szukające randek zobaczą Cię dopiero po dodaniu tego celu w profilu."
          : "W Twoim profilu nie ma celu „Znajomi”. Możesz przeglądać, ale osoby szukające znajomych zobaczą Cię dopiero po dodaniu tego celu w profilu.",
        [{ text: "Później", style: "cancel" }, { text: "Otwórz profil", onPress: () => setTab("profile") }]
      );
    }
  }
  const discoverModeSwitch = <ModeSwitch mode={deckMode} onChange={changeDiscoverMode} />;

  async function refreshDiscovery() {
    if (discoveryRefreshBusyRef.current) return;
    discoveryRefreshBusyRef.current = true;
    tap();
    try {
      if (appUser) await resetPassedProfiles();
      setPassedProfileKeys([]);
      setFeedExpansionLevel(0);
      trackSparkEvent("discovery_refreshed");
      setProfileReloadKey((value) => value + 1);
    } catch (error) {
      Alert.alert("Pomini\u0119te profile", error instanceof Error ? error.message : "Nie uda\u0142o si\u0119 przywr\u00f3ci\u0107 profili. Spr\u00f3buj ponownie.");
    } finally {
      discoveryRefreshBusyRef.current = false;
    }
  }

  async function ensureProAccess() {
    if (revenueCat.isPro) return true;

    const currentInfo = await revenueCat.refreshCustomerInfo();
    if (hasSparknewPro(currentInfo)) return true;

    setTab("premium");
    return false;
  }

  async function handleSwipe(action: SwipeAction): Promise<SwipeOutcome> {
    const targetProfile = activeProfile;
    const targetKey = activeProfileKey;
    const eventContext = discoverMode === "events" ? targetProfile?.sharedEvents?.[0] : undefined;

    if (!targetProfile || !targetKey) {
      return "cancelled";
    }

    tap();

    if (action === "superlike") {
      if (!(await ensureProAccess())) {
        return "cancelled";
      }

      if (superlikesRemaining <= 0) {
        Alert.alert("SparkLike", "Miesięczny limit SparkLike został wykorzystany.");
        return "cancelled";
      }

    }

    if (appUser && action !== "superlike") {
      try {
        const swipeResult = await recordProfileSwipe({
          swipeId: getThreadId(appUser.uid, targetKey),
          fromUid: appUser.uid,
          toProfileKey: targetKey,
          direction: action,
          matchScore: targetProfile.matchScore,
          eventContext,
          resetAtMs: targetProfile.isTestProfile ? Date.now() + 24 * 60 * 60 * 1000 : undefined
        });
        if (typeof swipeResult.superlikesRemaining === "number") {
          setSuperlikesRemaining(swipeResult.superlikesRemaining);
        }
      } catch (error) {
        Alert.alert(
          "Swipe",
          error instanceof Error ? error.message : "Nie uda\u0142o si\u0119 zapisa\u0107 decyzji. Spr\u00f3buj ponownie."
        );
        return "cancelled";
      }
    }

    if (action === "pass") {
      setPassedProfileKeys((keys) => (keys.includes(targetKey) ? keys : [...keys, targetKey]));
      trackSparkEvent("profile_swipe", { action: "pass", mode: discoverMode });
      noteFeedSwipe();
      return "passed";
    }

    if (action === "superlike") {
      if (!appUser) {
        Alert.alert("SparkLike", "Zaloguj się ponownie, aby utworzyć match.");
        return "cancelled";
      }
      const currentUserUid = appUser.uid;
      try {
        const result = await sendSparkLike({
          targetUid: targetKey,
          matchScore: targetProfile.matchScore,
          eventId: eventContext?.id,
          modeContext: discoverLens
        });
        setSuperlikesRemaining(result.superlikesRemaining);
      } catch (error) {
        Alert.alert("SparkLike", error instanceof Error ? error.message : "Nie uda\u0142o si\u0119 wys\u0142a\u0107 SparkLike. Spr\u00f3buj ponownie.");
        return "cancelled";
      }

      setLikedProfileKeys((keys) => keys.filter((key) => key !== targetKey));
      setMatchedProfileKeys((keys) => (keys.includes(targetKey) ? keys : [...keys, targetKey]));
      setSelectedChatKey(targetKey);
      setChatThreads((threads) => ({
        ...threads,
        [targetKey]: threads[targetKey] ?? {
          profileKey: targetKey,
          threadId: getConversationId(currentUserUid, targetKey),
          status: "matched",
          eventContext,
          messages: []
        }
      }));
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      deferredSwipeAdRef.current = true;
      setMatchCelebrationKind("sparkLike");
      setMatchCelebrationProfile(targetProfile);
      trackSparkEvent("profile_swipe", { action: "superlike", mode: discoverMode, matched: true });
      return "matched";
    }

    let isMutualMatch = Boolean(targetProfile.likedYou);

    if (!isMutualMatch && appUser && targetProfile.id) {
      try {
        isMutualMatch = await hasIncomingProfileLike({
          swipeId: getThreadId(targetKey, appUser.uid),
          fromUid: targetKey,
          toUid: appUser.uid
        });
      } catch {
        isMutualMatch = false;
      }
    }

    if (!isMutualMatch) {
      setLikedProfileKeys((keys) => (keys.includes(targetKey) ? keys : [...keys, targetKey]));
      trackSparkEvent("profile_swipe", { action: "like", mode: discoverMode, matched: false });
      noteFeedSwipe();
      return "liked";
    }

    if (appUser) {
      try {
        await createMatchThread({
          matchId: getConversationId(appUser.uid, targetKey),
          memberUids: [appUser.uid, targetKey],
          createdByUid: appUser.uid,
          source: "mutual-like",
          eventContext,
          modeContext: deckMode,
          resetAtMs: targetProfile.isTestProfile ? Date.now() + 24 * 60 * 60 * 1000 : undefined
        });
      } catch {
        Alert.alert("Match", "Nie uda\u0142o si\u0119 utworzy\u0107 matchu. Spr\u00f3buj ponownie.");
        return "cancelled";
      }
    }

    setLikedProfileKeys((keys) => keys.filter((key) => key !== targetKey));
    setMatchedProfileKeys((keys) => (keys.includes(targetKey) ? keys : [...keys, targetKey]));
    setSelectedChatKey(targetKey);
    setChatThreads((threads) => ({
      ...threads,
      [targetKey]: threads[targetKey] ?? {
        profileKey: targetKey,
        status: "matched",
        eventContext,
        messages: []
      }
    }));

    if (Platform.OS === "ios") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    deferredSwipeAdRef.current = true;
    setMatchCelebrationKind("mutual");
    setMatchCelebrationProfile(targetProfile);
    trackSparkEvent("profile_swipe", { action: "like", mode: discoverMode, matched: true });
    return "matched";
  }
  async function likeIncomingProfile(profileKey: string) {
    if (!appUser) return;
    const profile = availableProfiles.find((item) => getProfileKey(item) === profileKey);
    if (!profile) return;
    const eventContext = getSharedActiveEvents(activeEvents, profile.activeEvents ?? [])[0];

    try {
      await recordProfileSwipe({
        swipeId: getThreadId(appUser.uid, profileKey),
        fromUid: appUser.uid,
        toProfileKey: profileKey,
        direction: "like",
        matchScore: profile.matchScore,
        eventContext
      });
      await createMatchThread({
        matchId: getConversationId(appUser.uid, profileKey),
        memberUids: [appUser.uid, profileKey],
        createdByUid: appUser.uid,
        source: "mutual-like",
        eventContext,
        modeContext: relationMode(eventContext ? { eventContext } : undefined, profile, intents)
      });

      setIncomingLikeKinds((current) => {
        const next = { ...current };
        delete next[profileKey];
        return next;
      });
      setLikedProfileKeys((keys) => keys.filter((key) => key !== profileKey));
      setMatchedProfileKeys((keys) => keys.includes(profileKey) ? keys : [...keys, profileKey]);
      setChatThreads((threads) => ({
        ...threads,
        [profileKey]: threads[profileKey] ?? {
          profileKey,
          threadId: getConversationId(appUser.uid, profileKey),
          status: "matched",
          eventContext,
          messages: []
        }
      }));
      setMatchCelebrationKind("mutual");
      setMatchCelebrationProfile(profile);
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert("Match", error instanceof Error ? error.message : "Nie uda\u0142o si\u0119 utworzy\u0107 matchu.");
    }
  }

  async function sendPremiumChatRequest() {
    if (!activeProfile || !activeProfileKey) {
      return;
    }

    tap();

    if (!(await ensureProAccess())) {
      return;
    }

    if (hasMatchedActiveProfile) {
      Alert.alert("Chat", "Masz ju\u017c match z " + activeProfile.name + ". Rozmowa jest odblokowana.");
      setTab("messages");
      return;
    }

    if (hasRequestedActiveProfile) {
      Alert.alert("Pro\u015bba wys\u0142ana", "Jedna pro\u015bba o chat do " + activeProfile.name + " ju\u017c czeka na akceptacj\u0119.");
      return;
    }

    if (!appUser) {
      Alert.alert("Chat", "Zaloguj si\u0119 ponownie, aby wys\u0142a\u0107 pro\u015bb\u0119.");
      return;
    }

    try {
      const eventContext = discoverMode === "events" ? activeProfile.sharedEvents?.[0] : undefined;
      const introMessage = eventContext
        ? `Hej! Też wybieram się na „${eventContext.name}”. Chcesz pogadać przed wydarzeniem?`
        : buildConversationStarters(activeProfile, selectedInterests)[0];
      const requestResult = await createPremiumChatRequest({
        targetUid: activeProfileKey,
        introMessage,
        eventContext,
        modeContext: discoverLens
      });
      if (requestResult.status === "matched") {
        setChatRequestKeys((keys) => keys.filter((key) => key !== activeProfileKey));
        setMatchedProfileKeys((keys) => keys.includes(activeProfileKey) ? keys : [...keys, activeProfileKey]);
        setSelectedChatKey(activeProfileKey);
        setTab("messages");
        Alert.alert("Chat", "Rozmowa z " + activeProfile.name + " jest już aktywna.");
        return;
      }
      setChatRequestKeys((keys) => (keys.includes(activeProfileKey) ? keys : [...keys, activeProfileKey]));
      setSelectedChatKey(activeProfileKey);
      setChatThreads((threads) => ({
        ...threads,
        [activeProfileKey]: {
          profileKey: activeProfileKey,
          threadId: requestResult.threadId,
          createdByUid: appUser.uid,
          requestDirection: "outgoing",
          status: "requested",
          eventContext,
          introMessage,
          messages: []
        }
      }));
      Alert.alert(
        "Pro\u015bba o chat",
        "Wys\u0142ano pro\u015bb\u0119 do " + activeProfile.name + ". Pozosta\u0142o dzi\u015b: " + requestResult.remainingToday + "."
      );
    } catch (error) {
      Alert.alert("Pro\u015bba o chat", error instanceof Error ? error.message : "Nie uda\u0142o si\u0119 wys\u0142a\u0107 pro\u015bby. Spr\u00f3buj ponownie.");
      return;
    }
  }

  async function sendMessageToProfile(profileKey: string, text: string): Promise<boolean> {
    const message = text.trim();

    if (!message) {
      return false;
    }
    if (message.length > 2000) {
      Alert.alert("Chat", "Wiadomość może mieć maksymalnie 2000 znaków.");
      return false;
    }
    if (sendingMessageKeysRef.current.has(profileKey)) {
      return false;
    }

    const now = Date.now();
    recentMessageTimesRef.current = recentMessageTimesRef.current.filter((timestamp) => timestamp > now - 60_000);
    const lastMessageAt = recentMessageTimesRef.current.at(-1) ?? 0;
    if (now - lastMessageAt < 700) {
      Alert.alert("Zwolnij", "Odczekaj chwilę przed wysłaniem kolejnej wiadomości.");
      return false;
    }
    if (recentMessageTimesRef.current.length >= 20) {
      Alert.alert("Limit wiadomości", "Dla bezpieczeństwa możesz wysłać maksymalnie 20 wiadomości na minutę.");
      return false;
    }

    const moderationViolation = findModerationViolation(message);
    if (moderationViolation) {
      Alert.alert("Wiadomo\u015b\u0107 zablokowana", moderationViolation);
      return false;
    }

    const thread = chatThreads[profileKey];
    if (!thread || thread.status !== "matched") {
      Alert.alert("Chat", "Wiadomo\u015bci s\u0105 dost\u0119pne po matchu albo po zaakceptowaniu pro\u015bby.");
      return false;
    }

    if (!appUser) {
      Alert.alert("Chat", "Zaloguj si\u0119 ponownie, aby wys\u0142a\u0107 wiadomo\u015b\u0107.");
      return false;
    }

    const optimisticId = "local_" + Date.now();
    const optimisticMessage = {
      id: optimisticId,
      from: "me" as const,
      text: message,
      time: formatTime(Date.now())
    };
    sendingMessageKeysRef.current.add(profileKey);
    setChatThreads((threads) => threads[profileKey] ? {
      ...threads,
      [profileKey]: {
        ...threads[profileKey],
        lastMessageText: message.slice(0, 240),
        lastMessageAtMs: Date.now(),
        messages: [...threads[profileKey].messages, optimisticMessage]
      }
    } : threads);
    try {
      await sendChatMessage({
        threadId: thread.threadId ?? getConversationId(appUser.uid, profileKey),
        senderUid: appUser.uid,
        text: message
      });
      recentMessageTimesRef.current.push(Date.now());
      trackSparkEvent("chat_message_sent", { thread_status: thread.status });
      return true;
    } catch (error) {
      setChatThreads((threads) => threads[profileKey] ? {
        ...threads,
        [profileKey]: { ...threads[profileKey], messages: threads[profileKey].messages.filter((item) => item.id !== optimisticId) }
      } : threads);
      Alert.alert("Chat", error instanceof Error ? error.message : "Nie uda\u0142o si\u0119 wys\u0142a\u0107 wiadomo\u015bci. Spr\u00f3buj ponownie.");
      return false;
    } finally {
      sendingMessageKeysRef.current.delete(profileKey);
    }
  }

  async function acceptRequest(profileKey: string) {
    const thread = chatThreads[profileKey];
    if (!appUser || !thread?.threadId || thread.requestDirection !== "incoming") return;
    try { await acceptChatRequest(thread.threadId, appUser.uid); }
    catch { Alert.alert("Prośba o chat", "Nie udało się zaakceptować prośby. Spróbuj ponownie."); }
  }

  async function rejectRequest(profileKey: string) {
    const thread = chatThreads[profileKey];
    if (!appUser || !thread?.threadId || thread.requestDirection !== "incoming") return;
    try { await rejectChatRequest(thread.threadId, appUser.uid); setSelectedChatKey(null); }
    catch { Alert.alert("Prośba o chat", "Nie udało się odrzucić prośby. Spróbuj ponownie."); }
  }

  async function cancelOutgoingRequest(profileKey: string) {
    const thread = chatThreads[profileKey];
    if (!appUser || !thread?.threadId || thread.requestDirection !== "outgoing" || thread.status !== "requested") return;
    try {
      await cancelChatRequest(thread.threadId);
      setChatRequestKeys((keys) => keys.filter((key) => key !== profileKey));
      setChatThreads((threads) => {
        const next = { ...threads };
        delete next[profileKey];
        return next;
      });
      if (selectedChatKey === profileKey) setSelectedChatKey(null);
    } catch {
      Alert.alert("Pro\u015bba o chat", "Nie uda\u0142o si\u0119 anulowa\u0107 pro\u015bby. Spr\u00f3buj ponownie.");
    }
  }

  async function cancelOutgoingLike(profileKey: string) {
    if (!appUser) return;
    try {
      await cancelProfileLike(profileKey);
      setLikedProfileKeys((keys) => keys.filter((key) => key !== profileKey));
    } catch {
      Alert.alert("Polubienie", "Nie uda\u0142o si\u0119 usun\u0105\u0107 oczekuj\u0105cego polubienia. Spr\u00f3buj ponownie.");
    }
  }

  async function superlikePendingProfile(profileKey: string) {
    if (!appUser) {
      Alert.alert("SparkLike", "Zaloguj się ponownie, aby utworzyć match.");
      return;
    }
    if (!(await ensureProAccess())) return;
    if (superlikesRemaining <= 0) {
      Alert.alert("SparkLike", "Miesięczny limit SparkLike został wykorzystany.");
      return;
    }

    const profile = eventProfileSource.find((item) => getProfileKey(item) === profileKey);
    if (!profile) {
      Alert.alert("SparkLike", "Nie udało się odnaleźć tego profilu. Odśwież listę i spróbuj ponownie.");
      return;
    }

    const eventContext = chatThreads[profileKey]?.eventContext;
    try {
      const swipeResult = await sendSparkLike({
        targetUid: profileKey,
        matchScore: profile.matchScore,
        eventId: eventContext?.id,
        modeContext: relationMode(undefined, profile, intents) === "romantic" ? "romantic" : "friends"
      });

      if (typeof swipeResult.superlikesRemaining === "number") {
        setSuperlikesRemaining(swipeResult.superlikesRemaining);
      }
      setLikedProfileKeys((keys) => keys.filter((key) => key !== profileKey));
      setMatchedProfileKeys((keys) => (keys.includes(profileKey) ? keys : [...keys, profileKey]));
      setSelectedChatKey(profileKey);
      setChatThreads((threads) => ({
        ...threads,
        [profileKey]: {
          ...(threads[profileKey] ?? { profileKey, messages: [] }),
          threadId: getConversationId(appUser.uid, profileKey),
          status: "matched",
          eventContext
        }
      }));
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setMatchCelebrationKind("sparkLike");
      setMatchCelebrationProfile(profile);
    } catch (error) {
      Alert.alert("SparkLike", error instanceof Error ? error.message : "Nie udało się utworzyć matchu. Spróbuj ponownie.");
    }
  }

  async function blockProfile(profileKey: string) {
    if (appUser) {
      try {
        await blockUser({ blockerUid: appUser.uid, blockedUid: profileKey, threadId: chatThreads[profileKey]?.threadId });
      } catch {
        Alert.alert("Blokada", "Nie uda\u0142o si\u0119 zablokowa\u0107 profilu. Spr\u00f3buj ponownie.");
        return;
      }
    }

    setBlockedProfileKeys((keys) => (keys.includes(profileKey) ? keys : [...keys, profileKey]));
    setLikedProfileKeys((keys) => keys.filter((key) => key !== profileKey));
    setPassedProfileKeys((keys) => keys.filter((key) => key !== profileKey));
    setMatchedProfileKeys((keys) => keys.filter((key) => key !== profileKey));
    setChatRequestKeys((keys) => keys.filter((key) => key !== profileKey));
    setChatThreads((threads) => ({
      ...threads,
      [profileKey]: {
        ...(threads[profileKey] ?? { profileKey, messages: [] }),
        status: "blocked"
      }
    }));
    if (selectedChatKey === profileKey) {
      setSelectedChatKey(null);
    }
  }

  async function unblockProfile(profileKey: string): Promise<boolean> {
    if (!appUser) return false;
    try {
      await unblockUser(appUser.uid, profileKey);
      setBlockedProfileKeys((keys) => keys.filter((key) => key !== profileKey));
      setChatThreads((threads) => {
        const next = { ...threads };
        if (next[profileKey]?.status === "blocked") delete next[profileKey];
        return next;
      });
      return true;
    } catch {
      Alert.alert("Odblokowanie", "Nie udało się odblokować profilu. Sprawdź połączenie i spróbuj ponownie.");
      return false;
    }
  }
  async function reportProfile(profileKey: string, reason = "Nieodpowiedni profil lub wiadomo\u015b\u0107"): Promise<boolean> {
    if (!appUser) {
      Alert.alert("Zg\u0142oszenie", "Zaloguj si\u0119 ponownie, aby wys\u0142a\u0107 zg\u0142oszenie.");
      return false;
    }

    try {
      const thread = chatThreads[profileKey];
      const targetProfile = availableProfiles.find((profile) => getProfileKey(profile) === profileKey);
      await createReport({
        reporterUid: appUser.uid,
        targetUid: profileKey,
        reason: reason.slice(0, 200),
        context: JSON.stringify({
          source: thread?.threadId ? "chat" : "profile",
          threadId: thread?.threadId ?? null,
          targetProfile: targetProfile ? {
            name: [targetProfile.name, targetProfile.surname].filter(Boolean).join(" ").slice(0, 160),
            age: targetProfile.age,
            city: targetProfile.city.slice(0, 120)
          } : null,
          recentMessages: (thread?.messages ?? []).slice(-5).map((message) => ({
            from: message.from,
            text: message.text.slice(0, 500),
            time: message.time
          }))
        }).slice(0, 4000)
      });
      return true;
    } catch {
      Alert.alert("Zg\u0142oszenie", "Nie uda\u0142o si\u0119 wys\u0142a\u0107 zg\u0142oszenia. Spr\u00f3buj ponownie.");
      return false;
    }
  }
  async function performSignOut() {
    try {
      await signOutUser();
      setTab("discover");
      setSelectedChatKey(null);
      setPendingMessageDraft(null);
      setAuthError(null);
    } catch (error) {
      Alert.alert("Wylogowanie", error instanceof Error ? error.message : "Nie udało się wylogować.");
    }
  }

  function confirmSignOut() {
    Alert.alert("Wyloguj się", "Czy na pewno chcesz zakończyć sesję na tym urządzeniu?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Wyloguj", style: "destructive", onPress: () => void performSignOut() }
    ]);
  }

  async function performDeleteAccount() {
    if (!appUser) {
      Alert.alert("Usuń konto", "Musisz być zalogowany, aby usunąć konto.");
      return;
    }

    try {
      if (currentUserUsesAppleSignIn()) {
        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce
        );
        const credential = await AppleAuthentication.signInAsync({ nonce: hashedNonce });
        if (!credential.identityToken || !credential.authorizationCode) {
          throw new Error("Apple nie zwr\u00f3ci\u0142 danych potrzebnych do usuni\u0119cia konta.");
        }
        await reauthenticateAndRevokeApple({
          idToken: credential.identityToken,
          rawNonce,
          authorizationCode: credential.authorizationCode
        });
      } else {
        await ensureRecentLoginForAccountDeletion();
      }
      await requestAccountDeletionAndDeleteProfile({
        uid: appUser.uid
      });
      await signOutUser().catch(() => undefined);

      setAppUser(null);
      setAuthDone(false);
      setOnboarded(false);
      setLikedProfileKeys([]);
      setPassedProfileKeys([]);
      setMatchedProfileKeys([]);
      setMatchCelebrationProfile(null);
      setChatRequestKeys([]);
      setBlockedProfileKeys([]);
      setChatThreads({});
      setSelectedChatKey(null);
      setTab("discover");
      Alert.alert("Konto usunięte", "Konto, profil, zdjęcia i dane powiązane zostały trwale usunięte.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się usunąć konta.";
      setAuthError(message);
      Alert.alert("Usuń konto", message);
    }
  }

  async function openSubscriptionManagementBeforeDeletion() {
    const result = await revenueCat.openCustomerCenter();
    if (!result.ok) {
      Alert.alert("Subskrypcje", "Nie uda\u0142o si\u0119 otworzy\u0107 zarz\u0105dzania subskrypcj\u0105. Otw\u00f3rz Ustawienia iPhone > Apple ID > Subskrypcje.");
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "Usu\u0144 konto",
      "To trwale usunie konto, profil, zdj\u0119cia, matche i wiadomo\u015bci. Usuni\u0119cie konta nie anuluje aktywnej subskrypcji Apple. Tej akcji nie mo\u017cna cofn\u0105\u0107.",
      [
        { text: "Anuluj", style: "cancel" },
        { text: "Zarz\u0105dzaj subskrypcj\u0105", onPress: () => void openSubscriptionManagementBeforeDeletion() },
        { text: "Usu\u0144 teraz", style: "destructive", onPress: () => void performDeleteAccount() }
      ]
    );
  }
  if (authRestoring) {
    return (
      <ScreenFrame contentPadding={contentPadding}>
        <View style={styles.authRestore}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </ScreenFrame>
    );
  }

  if (!authDone) {
    return (
      <ScreenFrame contentPadding={contentPadding}>
        <AuthScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          authBusy={authBusy}
          authError={authError}
          firebaseReady={isFirebaseConfigured}
          firebaseMissingConfig={firebaseConfigStatus.missingConfig}
          googleReady={isGoogleSignInConfigured}
          appleReady={appleSignInAvailable}
          onContinue={() => {
            tap();
            handleEmailAuth();
          }}
          onGoogle={() => {
            tap();
            void handleGoogleSignIn();
          }}
          onApple={() => {
            tap();
            void handleAppleSignIn();
          }}
          onForgotPassword={() => {
            tap();
            void handlePasswordReset();
          }}
          showDemoLogin={showDemoLogin}
          onDemoAccount={() => {
            tap();
            handleDemoAccount();
          }}
        />
      </ScreenFrame>
    );
  }

  if (releaseConfig.maintenanceMode && !ownerProAccess) {
    return (
      <ScreenFrame contentPadding={contentPadding}>
        <View style={styles.appErrorRoot}>
          <MaterialCommunityIcons name="tools" size={42} color={colors.primary} />
          <Text style={styles.appErrorTitle}>{"Kr\u00f3tka przerwa techniczna"}</Text>
          <Text style={styles.appErrorBody}>{"Ulepszamy Spark. Wr\u00f3\u0107 za chwil\u0119, Twoje konto i dane s\u0105 bezpieczne."}</Text>
        </View>
      </ScreenFrame>
    );
  }

  if (!onboarded) {
    return (
      <ScreenFrame contentPadding={contentPadding}>
        <OnboardingScreen
          intents={intents}
          setIntents={setIntents}
          profileNameMode={profileNameMode}
          setProfileNameMode={setProfileNameMode}
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
          nickname={nickname}
          setNickname={setNickname}
          gender={gender}
          setGender={setGender}
          birthDate={birthDate}
          profileBio={profileBio}
          setProfileBio={setProfileBio}
          onBirthDateChange={(value) => {
            const formatted = formatBirthDateInput(value);
            setBirthDate(formatted);
            const age = calculateAge(formatted);
            if (age !== null) {
              setUserAge(age);
              setAgeBand(age >= 18 ? "18+" : null);
            }
          }}
          profilePhotos={profilePhotos}
          setProfilePhotos={setProfilePhotos}
          discoverFilters={discoverFilters}
          setDiscoverFilters={setDiscoverFilters}
          userCity={userCity}
          userCountry={userCountry}
          locationStatus={locationStatus}
          locationBusy={locationBusy}
          onRequestLocation={() => { void updateCurrentLocation(true); }}
          selectedInterests={selectedInterests}
          setSelectedInterests={setSelectedInterests}
          canContinue={canContinue}
          onContinue={async () => {
            if (!canContinue) {
              return;
            }
            tap();
            const saved = await saveProfileToFirestore();
            if (saved) setOnboarded(true);
          }}
        />
      </ScreenFrame>
    );
  }

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.root}>
      <StatusBar style={colors.statusBar} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        scrollEnabled={tab !== "discover"}
        bounces={false}
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, tab === "discover" && styles.discoverScroll, contentPadding]}
      >
        {tab === "discover" && activeProfile && (
          <DiscoverScreen
            modeSwitch={discoverModeSwitch}
            deckMode={deckMode}
            mode={discoverMode}
            feedExpansionLevel={feedExpansionLevel}
            activeEvents={activeEvents}
            profile={activeProfile}
            nextProfile={nextProfile}
            hasPro={revenueCat.isPro}
            onSwipe={handleSwipe}
            onPremiumChatRequest={sendPremiumChatRequest}
            onOpenMessages={() => setTab("messages")}
            messageNotificationCount={messageAttentionCount}
            onOpenMatches={() => setTab("matches")}
            onOpenProfile={() => setTab("profile")}
            onOpenPremium={openPremium}
            onOpenSafety={() => setTab("safety")}
            onSignOut={confirmSignOut}
            onInvite={() => { void shareSparkInvite(); }}
            hasMatchedProfile={hasMatchedActiveProfile}
            hasRequestedProfile={hasRequestedActiveProfile}
            superlikesRemaining={superlikesRemaining}
            selectedInterests={selectedInterests}
            discoverFilters={discoverFilters}
            screenMinHeight={discoverMinHeight}
            onReportProfile={async (reason) => activeProfileKey ? reportProfile(activeProfileKey, reason) : false}
            onRefresh={refreshDiscovery}
            onSavePreferences={saveDiscoveryPreferences}
            onOpenEventFriends={() => {
              if (activeEvents.length === 0) setEventManagerOpen(true);
              else setDiscoverMode("events");
            }}
            onBackToPeople={() => setDiscoverMode("people")}
            onManageEvents={() => setEventManagerOpen(true)}
            onChromeHiddenChange={setBottomNavHidden}
            sponsored={sponsoredCard === "idle" ? null : (
              <SponsoredDeckCard
                visible={sponsoredCard === "visible"}
                onLoaded={() => setSponsoredCard("visible")}
                onDone={() => setSponsoredCard("idle")}
                onUpgrade={() => { setSponsoredCard("idle"); openPremium("navigation"); }}
              />
            )}
          />
        )}
        {tab === "discover" && !activeProfile && discoverMode === "events" && (
          <EventFriendsEmptyState
            modeSwitch={discoverModeSwitch}
            screenMinHeight={discoverMinHeight}
            activeEvents={activeEvents}
            loading={eventProfilesLoading}
            error={eventProfilesError}
            expiredCount={expiredEventsCount}
            onBack={() => setDiscoverMode("people")}
            onManage={() => setEventManagerOpen(true)}
          />
        )}
        {tab === "discover" && !activeProfile && discoverMode === "people" && (
          <DiscoverEmptyState
            modeSwitch={discoverModeSwitch}
            screenMinHeight={discoverMinHeight}
            activeEventCount={activeEvents.length}
            feedExpansionLevel={feedExpansionLevel}
            likedCount={likedProfileKeys.length}
            loading={profilesLoading}
            error={profileFeedError}
            onRefresh={refreshDiscovery}
            onOpenMatches={() => setTab("matches")}
            onOpenMessages={() => setTab("messages")}
            messageNotificationCount={messageAttentionCount}
            onOpenProfile={() => setTab("profile")}
            onOpenPremium={openPremium}
            onOpenSafety={() => setTab("safety")}
            onSignOut={confirmSignOut}
            onInvite={() => { void shareSparkInvite(); }}
            discoverFilters={discoverFilters}
            onSavePreferences={saveDiscoveryPreferences}
            onOpenEventFriends={() => {
              if (activeEvents.length === 0) setEventManagerOpen(true);
              else setDiscoverMode("events");
            }}
            onChromeHiddenChange={setBottomNavHidden}
          />
        )}
        {tab === "matches" && (
          <MatchesScreen
            profiles={eventProfileSource}
            matchedProfileKeys={matchedProfileKeys}
            likedProfileKeys={likedProfileKeys}
            incomingLikeKinds={incomingLikeKinds}
            chatRequestKeys={chatRequestKeys}
            chatThreads={chatThreads}
            hasPro={revenueCat.isPro}
            viewerInterests={selectedInterests}
            viewerIntents={intents}
            onLikeIncomingProfile={likeIncomingProfile}
            onCancelPendingLike={cancelOutgoingLike}
            onSuperlikePendingProfile={superlikePendingProfile}
            onCancelRequest={cancelOutgoingRequest}
            onOpenMessages={() => setTab("messages")}
            onOpenConversation={(profileKey) => { setSelectedChatKey(profileKey); setTab("messages"); }}
          />
        )}
        {tab === "messages" && (
          <MessagesScreen
            profiles={eventProfileSource}
            matchedProfileKeys={matchedProfileKeys}
            chatRequestKeys={chatRequestKeys}
            chatThreads={chatThreads}
            selectedChatKey={selectedChatKey}
            setSelectedChatKey={setSelectedChatKey}
            pendingMessageDraft={pendingMessageDraft}
            onPendingMessageDraftConsumed={() => setPendingMessageDraft(null)}
            onSendMessage={sendMessageToProfile}
            onAcceptRequest={acceptRequest}
            onRejectRequest={rejectRequest}
            onBlockProfile={blockProfile}
            onReportProfile={reportProfile}
            viewerInterests={selectedInterests}
            viewerIntents={intents}
            showChatListAd={!revenueCat.isPro && adsReady}
          />
        )}
        {tab === "premium" && <PremiumScreen premiumPlan={premiumPlan} setPremiumPlan={setPremiumPlan} revenueCat={revenueCat} entrySource={premiumEntrySource} />}
        {tab === "safety" && <SafetyCenter userUid={appUser?.uid ?? ""} canManageModeration={ownerProAccess} onBack={() => setTab("profile")} onDeleteAccount={confirmDeleteAccount} blockedProfileKeys={blockedProfileKeys} onUnblock={unblockProfile} onReport={reportProfile} />}
        {tab === "profile" && (
          <ProfileScreen
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            profileNameMode={profileNameMode}
            setProfileNameMode={setProfileNameMode}
            nickname={nickname}
            setNickname={setNickname}
            gender={gender}
            setGender={setGender}
            birthDate={birthDate}
            intents={intents}
            setIntents={setIntents}
            profileBio={profileBio}
            setProfileBio={setProfileBio}
            onBirthDateChange={(value) => {
              const formatted = formatBirthDateInput(value);
              setBirthDate(formatted);
              const age = calculateAge(formatted);
              if (age !== null) setUserAge(age);
            }}
            discoverFilters={discoverFilters}
            setDiscoverFilters={setDiscoverFilters}
            userCity={userCity}
            userCountry={userCountry}
            locationStatus={locationStatus}
            locationBusy={locationBusy}
            onRequestLocation={() => { void updateCurrentLocation(true); }}
            activeEvents={activeEvents}
            onManageEvents={() => setEventManagerOpen(true)}
            onOpenEventFeed={() => {
              setDiscoverMode("events");
              setTab("discover");
            }}
            onLeaveEvent={(eventId) => saveActiveEvents(activeEvents.filter((event) => event.id !== eventId))}
            email={email}
            selectedInterests={selectedInterests}
            setSelectedInterests={setSelectedInterests}
            userAge={userAge}
            setUserAge={setUserAge}
            profilePhotos={profilePhotos}
            setProfilePhotos={setProfilePhotos}


            profileName={profileName}
            socialHandles={socialHandles}
            setSocialHandles={setSocialHandles}
            premiumPlan={premiumPlan}
            hasPro={revenueCat.isPro}
            profileViewers={profileViewers}
            profileViewerCount={profileViewerCount}
            profileViewersLoading={profileViewersLoading}
            openPremium={openPremium}
            openCustomerCenter={revenueCat.openCustomerCenter}
            openSafety={() => setTab("safety")}
            onSave={saveProfileToFirestore}
            onSignOut={confirmSignOut}
            onInvite={() => { void shareSparkInvite(); }}
            lgbt={lgbt}
            lgbtBusy={lgbtBusy}
            onChangeLgbt={(value) => void changeLgbt(value)}
            verificationStatus={profileVerificationStatus}
          />
        )}
        <SparkAdBanner enabled={showCurrentBanner} placement={tab} tone={colors.name === "dark" ? "dark" : "light"} />
      </ScrollView>
      <EventFriendsManagerModal
        key={appUser?.uid ?? "signed-out"}
        visible={eventManagerOpen}
        events={activeEvents}
        availableEvents={sparkEvents}
        userCity={userCity}
        userCountry={userCountry}
        userCountryCode={userCountryCode || "PL"}
        expiredCount={expiredEventsCount}
        canManage={canManageSparkEvents}
        catalogLoading={sparkEventsLoading}
        catalogError={sparkEventsError}
        onClose={() => setEventManagerOpen(false)}
        onSave={async (events) => {
          const saved = await saveActiveEvents(events);
          if (saved && events.length > 0) setDiscoverMode("events");
          return saved;
        }}
        eventDetails={sparkEventDetails}
        proposals={eventProposals}
        proposalsLoading={eventProposalsLoading}
        proposalsError={eventProposalsError}
        onReloadProposals={() => void loadEventProposals()}
        onReloadCatalog={() => setEventCatalogReload((current) => current + 1)}
        onPropose={async (event, details) => {
          if (!appUser) return false;
          try {
            await submitEventProposal(appUser.uid, event, details);
            if (currentEventUser.current !== appUser.uid) return false;
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Zgłoszenie wysłane", "Dzięki! Sprawdzimy wydarzenie i damy Ci znać powiadomieniem.");
            void loadEventProposals();
            return true;
          } catch (error) {
            Alert.alert("Nie udało się wysłać", error instanceof Error ? error.message : "Spróbuj ponownie.");
            return false;
          }
        }}
        onReviewProposal={async (proposal, status, editedEvent, editedDetails) => {
          if (!appUser || !canManageSparkEvents) return false;
          try {
            const event = editedEvent ?? proposal.event;
            const details = editedDetails ?? proposal.details;
            if (status === "approved") {
              if (!isEventActive(event)) {
                Alert.alert("Data wydarzenia", "To wydarzenie już się skończyło. Edytuj datę albo odrzuć zgłoszenie.");
                return false;
              }
              if (!sparkEvents.some((item) => item.id === event.id)) await publishSparkEvent(appUser.uid, event, details);
            }
            await reviewEventProposal(proposal.id, status, editedEvent, editedDetails);
            if (currentEventUser.current !== appUser.uid) return false;
            setEventProposals((current) => current.filter((item) => item.id !== proposal.id));
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return true;
          } catch (error) {
            Alert.alert("Nie udało się zapisać decyzji", error instanceof Error ? error.message : "Spróbuj ponownie.");
            return false;
          }
        }}
        onWithdrawProposal={async (proposal) => {
          try {
            const uid = appUser?.uid;
            await withdrawEventProposal(proposal.id);
            if (!uid || currentEventUser.current !== uid) return false;
            setEventProposals((current) => current.filter((item) => item.id !== proposal.id));
            return true;
          } catch {
            Alert.alert("Nie udało się wycofać", "Sprawdź połączenie i spróbuj ponownie.");
            return false;
          }
        }}
        onCreate={async (event, details) => {
          if (!appUser || !canManageSparkEvents) return false;
          try {
            await publishSparkEvent(appUser.uid, event, details);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return true;
          } catch (error) {
            Alert.alert("Nie udało się opublikować", error instanceof Error ? error.message : "Spróbuj ponownie.");
            return false;
          }
        }}
        onDelete={async (event) => {
          if (!canManageSparkEvents) return false;
          try {
            await removeSparkEvent(event.id);
            if (activeEvents.some((item) => item.id === event.id)) {
              await saveActiveEvents(activeEvents.filter((item) => item.id !== event.id));
            }
            return true;
          } catch {
            Alert.alert("Nie udało się usunąć", "Sprawdź połączenie i spróbuj ponownie.");
            return false;
          }
        }}
      />
      <MatchCelebration
        profile={matchCelebrationProfile}
        viewerInterests={selectedInterests}
        sparkLike={matchCelebrationKind === "sparkLike"}
        onContinue={() => {
          if (appUser && matchCelebrationProfile) {
            void registerPositiveMatchForReview(appUser.uid);
          }
          setMatchCelebrationProfile(null);
          setMatchCelebrationKind("mutual");
        }}
        onOpenChat={(starter) => {
          if (matchCelebrationProfile) {
            setSelectedChatKey(getProfileKey(matchCelebrationProfile));
            if (appUser) {
              void registerPositiveMatchForReview(appUser.uid);
            }
          }
          if (matchCelebrationProfile) {
            setPendingMessageDraft({ profileKey: getProfileKey(matchCelebrationProfile), text: starter ?? "" });
          }
          setMatchCelebrationProfile(null);
          setMatchCelebrationKind("mutual");
          setTab("messages");
        }}
      />
      {!bottomNavHidden && (
        <GlassSurface intensity={60} style={[styles.bottomNav, { bottom: Math.max(insets.bottom - 2, 6) }]}>
        {[
          ["discover", "Odkrywaj", tab === "discover" ? "compass" : "compass-outline"],
          ["matches", "Matche", tab === "matches" ? "heart" : "heart-outline"],
          ["messages", "Czat", tab === "messages" ? "chat" : "chat-outline"],
          ["premium", "Pro", tab === "premium" ? "crown" : "crown-outline"],
          ["profile", "Profil", tab === "profile" ? "account" : "account-outline"]
        ].map(([key, label, icon]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => {
              tap();
              if (key === "discover" && tab === "discover" && discoverMode === "events") setDiscoverMode("people");
              if (key === "premium") openPremium();
              else setTab(key as Tab);
            }}
            style={[styles.navButton, tab === key && styles.navButtonActive]}
          >
            <View style={styles.navIconWrap}>
              <MaterialCommunityIcons name={icon as any} size={22} color={tab === key ? colors.primary : colors.inkSoft} />
              {key === "messages" && messageAttentionCount > 0 && <View style={styles.navUnreadBadge}><Text style={styles.navUnreadBadgeText}>{formatBadgeCount(messageAttentionCount)}</Text></View>}
            </View>
            <Text style={[styles.navText, tab === key && styles.navTextActive]}>{label}</Text>
          </Pressable>
        ))}
        </GlassSurface>
      )}
    </LinearGradient>
  );
}

function AnimatedBackground() {
  const { styles } = useAppTheme();
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          toValue: 1,
          duration: 6200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 6200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true
        })
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [motion]);

  const glowOpacity = motion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.62, 0.26] });
  const sweepOpacity = motion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.28, 0.1] });
  const sweepX = motion.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] });
  const sweepY = motion.interpolate({ inputRange: [0, 1], outputRange: [24, -28] });
  const pulseScale = motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View pointerEvents="none" style={styles.animatedBackground}>
      <Animated.View style={[styles.backgroundRoseWash, { opacity: glowOpacity, transform: [{ scale: pulseScale }] }]} />
      <Animated.View style={[styles.backgroundRoseSweep, { opacity: sweepOpacity, transform: [{ translateX: sweepX }, { translateY: sweepY }, { rotate: "-18deg" }] }]} />
      <Animated.View style={[styles.backgroundRoseHorizon, { opacity: glowOpacity }]} />
    </View>
  );
}

function ScreenFrame({ children, contentPadding }: { children: React.ReactNode; contentPadding: object }) {
  const { colors, styles } = useAppTheme();
  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.root}>
      <AnimatedBackground />
      <StatusBar style={colors.statusBar} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, contentPadding]}
      >
        {children}
      </ScrollView>
    </LinearGradient>
  );
}

function SparkTitle() {
  const { styles } = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true
        })
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.36, 0.96, 0.42] });
  const pinkLayerOpacity = pulse.interpolate({ inputRange: [0, 0.48, 1], outputRange: [0.14, 0.78, 0.22] });
  const shimmerOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.75, 0] });
  const shimmerX = pulse.interpolate({ inputRange: [0, 1], outputRange: [-68, 68] });
  const translateY = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const rotate = pulse.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "1deg"] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.024] });

  return (
    <Animated.View accessibilityLabel="Spark" style={[styles.sparkTitleWrap, { transform: [{ translateY }, { scale }, { rotate }] }]}>
      <Animated.Text selectable={false} style={[styles.sparkTitleGlow, { opacity: glowOpacity }]}>Spark</Animated.Text>
      <Animated.Text selectable={false} style={[styles.sparkTitlePink, { opacity: pinkLayerOpacity }]}>Spark</Animated.Text>
      <Text style={styles.sparkTitle} selectable>Spark</Text>
      <Animated.View style={[styles.sparkTitleShimmer, { opacity: shimmerOpacity, transform: [{ translateX: shimmerX }, { rotate: "-14deg" }] }]} />
    </Animated.View>
  );
}

function AuthScreen({
  authMode,
  setAuthMode,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  authBusy,
  authError,
  firebaseReady,
  firebaseMissingConfig,
  googleReady,
  appleReady,
  showDemoLogin,
  onContinue,
  onGoogle,
  onApple,
  onForgotPassword,
  onDemoAccount
}: {
  authMode: AuthMode;
  setAuthMode: (value: AuthMode) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  authBusy: boolean;
  authError: string | null;
  firebaseReady: boolean;
  firebaseMissingConfig: string[];
  googleReady: boolean;
  appleReady: boolean;
  showDemoLogin: boolean;
  onContinue: () => void;
  onGoogle: () => void;
  onApple: () => void;
  onForgotPassword: () => void;
  onDemoAccount: () => void;
}) {
  const { colors, styles } = useAppTheme();
  const [legalAccepted, setLegalAccepted] = useState(false);
  const submitDisabled = !firebaseReady || authBusy || (authMode === "register" && !legalAccepted);
  const socialDisabled = !firebaseReady || authBusy || (authMode === "register" && !legalAccepted);
  return (
    <View style={styles.authShell}>
      <View style={styles.authHero}>
        <View style={styles.loginLogoMark}>
          <Image source={loginLogoImage} style={styles.loginLogoImage} contentFit="contain" />
        </View>
        <Text style={styles.authEyebrow}>SPARK</Text>
        <Text style={styles.authTitle} selectable>{authMode === "login" ? "Mi\u0142o Ci\u0119 widzie\u0107" : "Do\u0142\u0105cz do Spark"}</Text>
        <Text style={styles.authSubtitle} selectable>{authMode === "login" ? "Wr\u00f3\u0107 do rozm\u00f3w i nowych znajomo\u015bci." : "Utw\u00f3rz konto i zbuduj sw\u00f3j profil w kilka chwil."}</Text>
      </View>

      {!firebaseReady && (
        <View style={styles.configWarning}>
          <Text style={styles.configWarningTitle} selectable>Konfiguracja Firebase</Text>
          <Text style={styles.configWarningText} selectable>
            Uzupełnij .env wartościami EXPO_PUBLIC_FIREBASE_*. Brakuje: {firebaseMissingConfig.join(", ")}.
          </Text>
        </View>
      )}

      {authError && (
        <View style={styles.configWarning}>
          <Text style={styles.configWarningTitle} selectable>Nie udało się zalogować</Text>
          <Text style={styles.configWarningText} selectable>{authError}</Text>
        </View>
      )}

      <View style={styles.segmented}>
        {(["login", "register"] as AuthMode[]).map((item) => (
          <Pressable key={item} onPress={() => setAuthMode(item)} style={[styles.segmentButton, authMode === item && styles.segmentButtonActive]}>
            <Text style={[styles.segmentText, authMode === item && styles.segmentTextActive]}>{item === "login" ? "Logowanie" : "Rejestracja"}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.formCard}>
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="Hasło" value={password} onChangeText={setPassword} secureTextEntry passwordMode={authMode === "register" ? "new-password" : "current-password"} />
        {authMode === "register" && (
          <>
            <TextField label="Powtórz hasło" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry passwordMode="new-password" />
            <View style={styles.legalConsent}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: legalAccepted }} onPress={() => setLegalAccepted((value) => !value)} style={[styles.legalCheckbox, legalAccepted && styles.legalCheckboxActive]}>
                {legalAccepted && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
              </Pressable>
              <View style={styles.legalConsentCopy}>
                <Text style={styles.legalConsentText}>Akceptuje zasady Spark:</Text>
                <View style={styles.legalLinkRow}>
                  <Pressable onPress={() => openLegalDocument("Regulamin", legalLinks.terms, "EXPO_PUBLIC_TERMS_URL")}><Text style={styles.legalLink}>Regulamin</Text></Pressable>
                  <Text style={styles.legalConsentText}>i</Text>
                  <Pressable onPress={() => openLegalDocument("Polityka prywatności", legalLinks.privacy, "EXPO_PUBLIC_PRIVACY_POLICY_URL")}><Text style={styles.legalLink}>Politykę prywatności</Text></Pressable>
                </View>
              </View>
            </View>
          </>
        )}
        <Pressable accessibilityRole="button" disabled={submitDisabled} onPress={onContinue} style={[styles.primaryButton, submitDisabled && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>{authBusy ? "Łączenie..." : authMode === "login" ? "Zaloguj" : "Utwórz konto"}</Text>
        </Pressable>
        {authMode === "login" ? (
          <Pressable accessibilityRole="button" disabled={authBusy} onPress={onForgotPassword} style={styles.forgotPasswordButton}>
            <Text style={styles.forgotPasswordText}>Nie pamiętasz hasła?</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={authBusy}
            onPress={() => {
              setAuthMode("login");
              setConfirmPassword("");
            }}
            style={styles.authBackToLoginButton}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={colors.primary} />
            <Text style={styles.authBackToLoginText}>Mam już konto — Zaloguj się</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.authDivider}>
        <View style={styles.authDividerLine} />
        <Text style={styles.authDividerText}>lub kontynuuj przez</Text>
        <View style={styles.authDividerLine} />
      </View>
      <View style={styles.socialLoginGrid}>
        {appleReady && (
          <View pointerEvents={socialDisabled ? "none" : "auto"} style={socialDisabled && styles.socialLoginButtonDisabled}>
            <AppleAuthentication.AppleAuthenticationButton
              accessibilityLabel="Kontynuuj z Apple"
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={18}
              onPress={onApple}
              style={styles.appleLoginButton}
            />
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={socialDisabled || !googleReady}
          onPress={onGoogle}
          style={[styles.socialLoginButton, (socialDisabled || !googleReady) && styles.socialLoginButtonDisabled]}
        >
          <FontAwesome name="google" size={18} color="#fff" />
          <Text style={styles.socialLoginText}>Kontynuuj z Google</Text>
        </Pressable>
      </View>

      {showDemoLogin && (
        <Pressable
          accessibilityRole="button"
          disabled={!firebaseReady || authBusy}
          onPress={onDemoAccount}
          style={[styles.secondaryButtonWide, (!firebaseReady || authBusy) && styles.socialLoginButtonDisabled]}
        >
          <Text style={styles.secondaryButtonText}>Konto testowe: tester@spark.app</Text>
        </Pressable>
      )}
    </View>
  );
}

function LocationControl({ city, country, status, busy, onPress }: { city: string; country: string; status: "idle" | "granted" | "denied"; busy: boolean; onPress: () => void }) {
  const { colors, styles } = useAppTheme();
  const place = [city, country].filter(Boolean).join(", ");
  const label = busy ? "Pobieranie lokalizacji..." : place ? "Od\u015bwie\u017c lokalizacj\u0119" : status === "denied" ? "W\u0142\u0105cz lokalizacj\u0119 w ustawieniach" : "U\u017cyj mojej lokalizacji";

  return (
    <View style={styles.locationControl}>
      {place ? <View style={styles.locationStatus}><MaterialCommunityIcons name="map-marker" size={16} color={colors.green} /><Text style={styles.locationStatusText}>{place}</Text></View> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={({ pressed }) => [styles.locationAction, busy && styles.primaryButtonDisabled, pressed && styles.controlPressed]}>
        {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="crosshairs-gps" size={18} color={colors.primary} />}
        <Text style={styles.locationActionText}>{label}</Text>
      </Pressable>
      <Text style={styles.locationPrivacyText}>Opcjonalne. Publicznie pokazujemy tylko przybliżoną odległość oraz miasto lub kraj.</Text>
    </View>
  );
}

function ProfileBioInput({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  const { colors, styles } = useAppTheme();
  const remaining = 300 - value.length;
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.profileBioHeader}>
        <Text style={styles.fieldLabel}>Opis profilu</Text>
        <Text style={styles.profileBioCounter}>{remaining} znaków</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.slice(0, 300))}
        multiline
        maxLength={300}
        textAlignVertical="top"
        placeholder="Napisz kilka zdań o sobie, swoich pasjach i osobach, które chcesz poznać."
        placeholderTextColor={colors.muted}
        selectionColor="rgba(255,45,141,0.35)"
        cursorColor={colors.primary}
        style={[styles.fieldInput, styles.profileBioInput]}
      />
      <Text style={styles.profileBioHint}>{value.trim().length < 20 ? "Minimum 20 znaków" : "Opis będzie widoczny na Twojej karcie"}</Text>
    </View>
  );
}

function IntentMultiSelect({ selected, onChange, compact = false }: { selected: SparkIntent[]; onChange: (value: SparkIntent[]) => void; compact?: boolean }) {
  const { colors, styles } = useAppTheme();
  function toggleIntent(label: SparkIntent) {
    const current: SparkIntent[] = selected.filter((item) => item !== "LGBT+ / Społeczność");
    const next = current.includes(label) ? current.filter((item) => item !== label) : [...current, label];
    if (next.length === 0) {
      Alert.alert("Wybierz cel", "Zaznacz przynajmniej jedną kategorię.");
      return;
    }
    onChange(next.slice(0, 3));
  }

  return (
    <View style={[styles.intentList, compact && styles.intentListCompact]}>
      {sparkIntentOptions.filter((option) => option.label !== "LGBT+ / Społeczność").map(({ label, displayLabel, icon, rainbow }) => {
        const active = selected.includes(label);
        const iconContent = <MaterialCommunityIcons name={active ? "check-bold" : icon} size={compact ? 21 : 25} color={rainbow ? "#fff" : colors.primaryDeep} />;
        return (
          <Pressable key={label} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => toggleIntent(label)} style={({ pressed }) => [styles.intentCard, compact && styles.intentCardCompact, active && styles.intentCardActive, pressed && styles.controlPressed]}>
            {rainbow ? <LinearGradient colors={["#ff4f9a", "#9a5cff", "#35c6ff", "#45d18f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.intentIcon, styles.intentIconRainbow]}>{iconContent}</LinearGradient> : <View style={styles.intentIcon}>{iconContent}</View>}
            <View style={styles.fill}><Text style={styles.intentTitle}>{displayLabel}</Text></View>
            <MaterialCommunityIcons name={active ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={active ? colors.primary : colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

function GenderIdentitySelect({ value, onChange, compact = false }: { value: ProfileGender; onChange: (value: ProfileGender) => void; compact?: boolean }) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {genderOptions.map((option) => {
        const active = value === option.value;
        return (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => onChange(option.value)} style={({ pressed }) => [{ width: "48%", minHeight: compact ? 46 : 54, flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, borderRadius: 16, borderWidth: 1, borderColor: active ? "rgba(255,45,141,0.52)" : "rgba(255,255,255,0.09)", backgroundColor: active ? "rgba(255,45,141,0.13)" : "rgba(255,255,255,0.04)" }, pressed && styles.controlPressed]}>
            <View style={{ width: 31, height: 31, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.primary : colors.primarySoft }}>
              <MaterialCommunityIcons name={option.icon} size={18} color={active ? "#fff" : colors.primaryDeep} />
            </View>
            <Text numberOfLines={2} style={{ flex: 1, color: active ? colors.ink : colors.muted, fontSize: compact ? 11 : 12, lineHeight: 15, fontWeight: "900" }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function GenderPreferencesEditor({ intents, value, onChange, compact = false }: { intents: SparkIntent[]; value: GenderPreferencesByIntent; onChange: (value: GenderPreferencesByIntent) => void; compact?: boolean }) {
  const { colors, styles } = useAppTheme();
  const visibleIntents = intents.length > 0 ? intents : sparkIntentLabels;
  function toggle(intent: SparkIntent, genderValue: DiscoverableGender) {
    const key = getIntentPreferenceKey(intent);
    const current = value[key];
    const next = current.includes(genderValue) ? current.filter((item) => item !== genderValue) : [...current, genderValue];
    if (next.length === 0) {
      Alert.alert("Preferencje", "Wybierz co najmniej jedn\u0105 p\u0142e\u0107 dla tej kategorii.");
      return;
    }
    onChange({ ...value, [key]: next });
  }
  return (
    <View style={{ gap: compact ? 9 : 12 }}>
      {visibleIntents.map((intent) => {
        const key = getIntentPreferenceKey(intent);
        const option = sparkIntentOptions.find((item) => item.label === intent);
        return (
          <View key={intent} style={{ gap: 8, padding: compact ? 10 : 12, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.075)" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name={option?.icon ?? "account-heart-outline"} size={17} color={colors.primary} />
              <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>{option?.displayLabel ?? intent}</Text>
              <Text style={{ marginLeft: "auto", color: colors.muted, fontSize: 9, fontWeight: "800" }}>{value[key].length === 3 ? "Wszyscy" : value[key].length + " wybrane"}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {genderOptions.filter((item) => item.value !== "unspecified").map((genderOption) => {
                const genderValue = genderOption.value as DiscoverableGender;
                const active = value[key].includes(genderValue);
                return (
                  <Pressable key={genderValue} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => toggle(intent, genderValue)} style={({ pressed }) => [{ flex: 1, minWidth: 0, minHeight: 43, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 13, borderWidth: 1, borderColor: active ? "rgba(255,45,141,0.42)" : "rgba(255,255,255,0.08)", backgroundColor: active ? colors.primarySoft : "rgba(255,255,255,0.025)" }, pressed && styles.controlPressed]}>
                    <MaterialCommunityIcons name={genderOption.icon} size={17} color={active ? colors.primary : colors.muted} />
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ color: active ? colors.ink : colors.muted, fontSize: 9, fontWeight: "900" }}>{genderOption.label.replace("Osoba niebinarna", "Niebinarna")}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function OnboardingScreen({
  intents, setIntents, profileNameMode, setProfileNameMode, firstName, setFirstName, lastName, setLastName,
  nickname, setNickname, gender, setGender, birthDate, onBirthDateChange, profileBio, setProfileBio, profilePhotos, setProfilePhotos,
  discoverFilters, setDiscoverFilters, userCity, userCountry, locationStatus, locationBusy, onRequestLocation, selectedInterests, setSelectedInterests,
  canContinue, onContinue
}: {
  intents: SparkIntent[]; setIntents: (value: SparkIntent[]) => void;
  profileNameMode: ProfileNameMode; setProfileNameMode: (value: ProfileNameMode) => void;
  firstName: string; setFirstName: (value: string) => void; lastName: string; setLastName: (value: string) => void;
  nickname: string; setNickname: (value: string) => void; gender: ProfileGender; setGender: (value: ProfileGender) => void; birthDate: string; onBirthDateChange: (value: string) => void;
  profileBio: string; setProfileBio: (value: string) => void;
  profilePhotos: ProfilePhoto[]; setProfilePhotos: (value: ProfilePhoto[]) => void;
  discoverFilters: DiscoverFilters; setDiscoverFilters: React.Dispatch<React.SetStateAction<DiscoverFilters>>;
  userCity: string; userCountry: string; locationStatus: "idle" | "granted" | "denied"; locationBusy: boolean; onRequestLocation: () => void; selectedInterests: string[]; setSelectedInterests: (value: string[]) => void;
  canContinue: boolean; onContinue: () => void;
}) {
  const { colors, styles } = useAppTheme();
  const derivedAge = calculateAge(birthDate);

  async function pickPhoto(index?: number) {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    const next = [...profilePhotos];
    if (index !== undefined) next[index] = uri;
    else if (next.length < 3) next.push(uri);
    setProfilePhotos(next.slice(0, 3));
  }

  function removePhoto(index: number) {
    if (profilePhotos.length <= 1) {
      Alert.alert("Zdj\u0119cia", "Profil musi mie\u0107 co najmniej jedno zdj\u0119cie.");
      return;
    }

    setProfilePhotos(profilePhotos.filter((_, photoIndex) => photoIndex !== index));
  }

  return (
    <View style={styles.gapLg}>
      <View style={styles.brandCompact}>
        <View style={styles.logoMark}><Image source={brandLogoImage} style={styles.logoImage} contentFit="cover" /></View>
        <Text style={styles.eyebrow}>Ustawienie konta</Text>
        <Text style={styles.screenHeroTitle}>Stwórz swój profil</Text>
        <Text style={styles.lead}>Te dane zbudują Twoją kartę. Wszystko zmienisz później w zakładce Profil.</Text>
      </View>

      <View style={styles.setupSection}>
        <View style={styles.setupSectionHeading}><View style={styles.setupIcon}><MaterialCommunityIcons name="account-edit" size={21} color={colors.primary} /></View><View style={styles.fill}><Text style={styles.panelTitle}>Jak mamy Cię pokazać?</Text><Text style={styles.panelText}>Wybierz prawdziwe imię albo nick.</Text></View></View>
        <Text style={styles.setupHelper}>Możesz pokazywać imię i nazwisko albo wyłącznie nick.</Text>
        <View style={styles.segmentedChoice}>
          <Pressable onPress={() => setProfileNameMode("realName")} style={[styles.segmentedChoiceItem, profileNameMode === "realName" && styles.segmentedChoiceItemActive]}><Text style={[styles.segmentedChoiceText, profileNameMode === "realName" && styles.segmentedChoiceTextActive]}>Imię i nazwisko</Text></Pressable>
          <Pressable onPress={() => setProfileNameMode("nickname")} style={[styles.segmentedChoiceItem, profileNameMode === "nickname" && styles.segmentedChoiceItemActive]}><Text style={[styles.segmentedChoiceText, profileNameMode === "nickname" && styles.segmentedChoiceTextActive]}>Nick</Text></Pressable>
        </View>
        {profileNameMode === "realName" ? <View style={styles.nameRow}><TextField label="Imię" value={firstName} onChangeText={setFirstName} /><TextField label="Nazwisko (opcjonalnie)" value={lastName} onChangeText={setLastName} /></View> : <TextField label="Nick" value={nickname} onChangeText={setNickname} />}
        <Text style={styles.fieldLabel}>Twoja płeć</Text>
        <GenderIdentitySelect value={gender} onChange={setGender} />
        <TextField label="Data urodzenia (RRRR-MM-DD)" value={birthDate} onChangeText={onBirthDateChange} keyboardType="numeric" />
        <Text style={styles.setupHelper}>{derivedAge === null ? "Podaj prawidłową datę urodzenia." : derivedAge < 18 ? String(derivedAge) + " lat - Spark jest dostępny od 18 lat." : derivedAge > 99 ? "Sprawdź rok urodzenia." : String(derivedAge) + " lat"}</Text>
        <ProfileBioInput value={profileBio} onChangeText={setProfileBio} />
        <LocationControl city={userCity} country={userCountry} status={locationStatus} busy={locationBusy} onPress={onRequestLocation} />
      </View>

      <View style={styles.setupSection}>
        <View style={styles.setupSectionHeading}><View style={styles.setupIcon}><MaterialCommunityIcons name="image-multiple" size={21} color={colors.primary} /></View><View style={styles.fill}><Text style={styles.panelTitle}>Zdjęcia profilu</Text><Text style={styles.panelText}>Dodaj zdjęcie główne i opcjonalnie dwa dodatkowe. Format 4:5.</Text></View></View>
        <View style={styles.onboardingPhotoGrid}>
          {[0, 1, 2].map((index) => {
            const photo = profilePhotos[index];
            const source = typeof photo === "string" ? { uri: photo } : photo;
            return (
              <Pressable key={index} onPress={() => void pickPhoto(photo ? index : undefined)} style={styles.onboardingPhotoSlot}>
                {source ? <Image source={source} style={styles.photoSlotImage} contentFit="cover" /> : <MaterialCommunityIcons name="camera-plus" size={27} color={colors.primary} />}
                {photo && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Usuń zdjęcie"
                    onPress={(event) => {
                      event.stopPropagation();
                      removePhoto(index);
                    }}
                    style={styles.photoRemoveButton}
                  >
                    <MaterialCommunityIcons name="close" size={16} color="#fff" />
                  </Pressable>
                )}
                <Text style={styles.photoSlotBadge}>{index === 0 ? "G\u0142\u00f3wne" : "Foto " + (index + 1)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.setupSection}>
        <Text style={styles.panelTitle}>Kogo chcesz poznać?</Text>
        <Text style={styles.panelText}>Wybierz jeden lub kilka klimatów. Feed połączy wszystkie wybrane kategorie.</Text>
        <IntentMultiSelect selected={intents} onChange={(nextIntents) => { setIntents(nextIntents); setDiscoverFilters((current) => ({ ...current, targetIntents: nextIntents })); }} />
        <Text style={styles.fieldLabel}>Kogo chcesz widzieć?</Text>
        <Text style={styles.setupHelper}>Ustaw osobno dla każdej wybranej kategorii.</Text>
        <GenderPreferencesEditor intents={intents} value={discoverFilters.targetGendersByIntent} onChange={(targetGendersByIntent) => setDiscoverFilters((current) => ({ ...current, targetGendersByIntent }))} />
        <Text style={styles.fieldLabel}>Preferowany wiek</Text>
        <AgeRangeControl min={discoverFilters.ageMin} max={discoverFilters.ageMax} onChange={(ageMin, ageMax) => setDiscoverFilters((current) => ({ ...current, ageMin, ageMax, targetIntents: current.targetIntents.length ? current.targetIntents : intents }))} />
        <View style={styles.settingRow}><View style={styles.fill}><Text style={styles.settingLabel}>Wymagaj wspólnego zainteresowania</Text><Text style={styles.settingHint}>Opcjonalne. Ukryje profile bez wspólnych tagów.</Text></View><Switch value={discoverFilters.requireCommonInterests} onValueChange={(value) => setDiscoverFilters((current) => ({ ...current, requireCommonInterests: value }))} trackColor={{ true: colors.green }} /></View>
      </View>

      <View style={styles.setupSection}>
        <Text style={styles.panelTitle}>Zainteresowania</Text>
        <Text style={styles.panelText}>Wybierz 3-15. Kategorie pomagają szybciej znaleźć swoje klimaty.</Text>
        <CategorizedInterestPicker selected={selectedInterests} onToggle={(item) => setSelectedInterests(toggleListItem(selectedInterests, item))} maxSelected={15} />
      </View>

      <Pressable accessibilityRole="button" disabled={!canContinue} onPress={onContinue} style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}>
        <Text style={styles.primaryButtonText}>{canContinue ? "Zapisz profil i zaczynamy" : "Uzupełnij dane, opis, zdjęcie i 3 zainteresowania"}</Text>
      </Pressable>
    </View>
  );
}
function DiscoverScreen({
  modeSwitch,
  deckMode,
  mode,
  feedExpansionLevel,
  activeEvents,
  profile,
  nextProfile,
  hasPro,
  onSwipe,
  onPremiumChatRequest,
  onOpenMessages,
  messageNotificationCount,
  onOpenMatches,
  onOpenProfile,
  onOpenPremium,
  onOpenSafety,
  onSignOut,
  onInvite,
  hasMatchedProfile,
  hasRequestedProfile,
  superlikesRemaining,
  selectedInterests,
  discoverFilters,
  screenMinHeight,
  onReportProfile,
  onRefresh,
  onSavePreferences,
  onOpenEventFriends,
  onBackToPeople,
  onManageEvents,
  onChromeHiddenChange,
  sponsored
}: {
  sponsored?: React.ReactNode;
  modeSwitch: React.ReactNode;
  deckMode: DeckMode;
  mode: DiscoverMode;
  feedExpansionLevel: number;
  activeEvents: SparkEvent[];
  profile: MatchProfile;
  nextProfile: MatchProfile | null;
  hasPro: boolean;
  onSwipe: (action: SwipeAction) => Promise<SwipeOutcome>;
  onPremiumChatRequest: () => void;
  onOpenMessages: () => void;
  messageNotificationCount: number;
  onOpenMatches: () => void;
  onOpenProfile: () => void;
  onOpenPremium: (source?: PremiumEntrySource) => void;
  onOpenSafety: () => void;
  onSignOut: () => void;
  onInvite: () => void;
  hasMatchedProfile: boolean;
  hasRequestedProfile: boolean;
  superlikesRemaining: number;
  selectedInterests: string[];
  discoverFilters: DiscoverFilters;
  screenMinHeight: number;
  onReportProfile: (reason?: string) => Promise<boolean>;
  onRefresh: () => void;
  onSavePreferences: (nextFilters: DiscoverFilters) => Promise<boolean>;
  onOpenEventFriends: () => void;
  onBackToPeople: () => void;
  onManageEvents: () => void;
  onChromeHiddenChange?: (hidden: boolean) => void;
}) {
  const { colors, styles } = useAppTheme();
  const [reportOpen, setReportOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [swipeBusy, setSwipeBusy] = useState(false);
  const [swipeFeedback, setSwipeFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const { width: viewportWidth } = useWindowDimensions();
  const exitX = Math.max(420, viewportWidth * 1.25);
  const profileKey = getProfileKey(profile);
  const premiumChatLabel = hasMatchedProfile ? "Chat" : hasRequestedProfile ? "Czeka" : "Napisz teraz";
  const premiumChatSub = hasMatchedProfile ? "Otwórz" : hasRequestedProfile ? "Wysłana" : "Pro";
  const primarySharedEvent = profile.sharedEvents?.[0];
  const swipeRotate = pan.x.interpolate({ inputRange: [-exitX, 0, exitX], outputRange: ["-16deg", "0deg", "16deg"] });
  const nextScale = pan.x.interpolate({ inputRange: [-260, 0, 260], outputRange: [1, 0.94, 1], extrapolate: "clamp" });
  const stamps = useMemo(() => ({
    like: pan.x.interpolate({ inputRange: [0, 130], outputRange: [0, 1], extrapolate: "clamp" }),
    pass: pan.x.interpolate({ inputRange: [-130, 0], outputRange: [1, 0], extrapolate: "clamp" }),
    superlike: pan.y.interpolate({ inputRange: [-130, -30], outputRange: [1, 0], extrapolate: "clamp" })
  }), [pan]);
  const overlayOpen = previewOpen || preferencesOpen || reportOpen || menuOpen;

  useEffect(() => {
    onChromeHiddenChange?.(overlayOpen);
    return () => onChromeHiddenChange?.(false);
  }, [onChromeHiddenChange, overlayOpen]);

  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
    setSwipeBusy(false);
  }, [profileKey, pan]);

  function springBack() {
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, speed: 20, bounciness: 7, useNativeDriver: true }).start();
  }

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  async function runProAction(action: () => void | Promise<void>, locked: boolean, source: PremiumEntrySource) {
    if (locked) {
      onOpenPremium(source);
      return;
    }

    await action();
  }

  async function runSwipeAction(action: SwipeAction) {
    if (swipeBusy) {
      return;
    }

    setSwipeBusy(true);
    const toValue = action === "superlike" ? { x: 0, y: -900 } : { x: action === "pass" ? -exitX : exitX, y: 0 };
    Animated.timing(pan, {
      toValue,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (!finished) {
        pan.setValue({ x: 0, y: 0 });
        setSwipeBusy(false);
        return;
      }

      void (async () => {
        try {
          const outcome = await onSwipe(action);
          const feedback =
            outcome === "liked"
              ? "Polubienie wysłane"
              : outcome === "passed"
                ? "Profil pominięty"
                : outcome === "matched"
                  ? action === "superlike" ? "SPARKLIKE! Match od razu" : "To match!"
                  : null;

          if (feedback) {
            setSwipeFeedback(feedback);
            if (feedbackTimer.current) {
              clearTimeout(feedbackTimer.current);
            }
            feedbackTimer.current = setTimeout(() => setSwipeFeedback(null), 1500);
          }
        } finally {
          pan.setValue({ x: 0, y: 0 });
          setSwipeBusy(false);
        }
      })();
    });
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => !swipeBusy && (Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 14),
        onPanResponderMove: (_, gesture) => pan.setValue({ x: gesture.dx, y: Math.min(gesture.dy, 60) * (Math.abs(gesture.dy) > Math.abs(gesture.dx) ? 1 : 0.25) }),
        onPanResponderRelease: (_, gesture) => {
          // Up = SPARKLIKE (Pro), left/right = pass/like.
          const up = gesture.dy < -110 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2;
          if (up || gesture.vy < -1.1) {
            springBack();
            void promptProFeature("superlike", () => runSwipeAction("superlike"), !hasPro);
            return;
          }
          if (Math.abs(gesture.dx) > 100 || Math.abs(gesture.vx) > 0.6) {
            void runSwipeAction(gesture.dx < 0 ? "pass" : "like");
            return;
          }
          springBack();
        },
        onPanResponderTerminate: springBack
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileKey, swipeBusy, pan, hasPro]
  );


  async function promptProFeature(kind: "superlike" | "message", action: () => void | Promise<void>, locked: boolean) {
    if (locked) {
      Alert.alert(
        "Spark Pro",
        kind === "superlike"
          ? "SPARKLIKE jest funkcją Pro. Odblokuj Pro, żeby wyróżniać profile i częściej pojawiać się na głównej."
          : "Wiadomość przed matchem jest funkcją Pro. Odblokuj Pro, żeby wysłać prośbę o chat do tej osoby."
      );
    }

    await runProAction(action, locked, kind === "superlike" ? "spark_like" : "chat_request");
  }
  function handlePremiumChat() {
    if (hasMatchedProfile) {
      onOpenMessages();
      return;
    }

    if (hasRequestedProfile) {
      Alert.alert("Prośba o chat", "Ta prośba już czeka na akceptację.");
      return;
    }

    onPremiumChatRequest();
  }

  function handlePreviewSuperlike() {
    setPreviewOpen(false);
    void promptProFeature("superlike", () => runSwipeAction("superlike"), !hasPro);
  }

  function handlePreviewLike() {
    setPreviewOpen(false);
    void runSwipeAction("like");
  }

  function handlePreviewMessage() {
    setPreviewOpen(false);
    handlePremiumChat();
  }

  async function sendReport() {
    const description = reportText.trim();

    if (description.length < 8) {
      Alert.alert("Zg\u0142oszenie", "Opisz problem troch\u0119 dok\u0142adniej.");
      return;
    }

    if (!(await onReportProfile(description))) {
      return;
    }

    setReportOpen(false);
    setReportText("");
    Alert.alert("Zg\u0142oszenie wys\u0142ane", "Dzi\u0119kujemy. Zesp\u00f3\u0142 moderacji sprawdzi zg\u0142oszenie wraz z dost\u0119pnym kontekstem.");
  }

  return (
    <View style={[styles.discoverScreen, { minHeight: screenMinHeight }]}>
      <DiscoverHeader
        left={mode === "events"
          ? { icon: "chevron-left", label: "Wróć do osób", onPress: onBackToPeople }
          : { icon: "menu", label: "Menu", onPress: () => setMenuOpen(true), dot: messageNotificationCount > 0 }}
        actions={mode === "events" ? [{ icon: "calendar-edit", label: "Twoje wydarzenia", onPress: onManageEvents }] : []}
        onFilters={mode === "events" ? undefined : () => setPreferencesOpen(true)}
        filtersActive={countActiveDiscoverFilters(discoverFilters) > 0}
      />
      {modeSwitch}
      {mode === "people" && feedExpansionLevel > 0 && (
        <Pressable accessibilityRole="button" onPress={() => setPreferencesOpen(true)} style={styles.feedExpansionNotice}>
          <MaterialCommunityIcons name="map-marker-radius-outline" size={16} color={colors.primaryDeep} />
          <Text style={styles.feedExpansionNoticeText}>Blisko nikogo nie ma — pokazujemy też dalsze profile</Text>
          <MaterialCommunityIcons name="tune-variant" size={16} color={colors.muted} />
        </Pressable>
      )}
      {mode === "events" ? (
        <Pressable accessibilityRole="button" onPress={onManageEvents} style={[styles.eventFriendsLaunch, styles.eventFriendsLaunchActive, styles.eventFriendsLaunchParty]}>
          <View style={[styles.eventFriendsLaunchIcon, styles.eventFriendsLaunchPartyIcon]}><MaterialCommunityIcons name={(primarySharedEvent?.icon ?? "calendar-heart") as any} size={20} color="#fff" /></View>
          <View style={styles.fill}>
            <Text style={[styles.eventFriendsLaunchEyebrow, styles.eventFriendsLaunchPartyEyebrow]}>TRYB EVENTOWY • TWOJA EKIPA</Text>
            <Text style={styles.eventFriendsLaunchTitle} numberOfLines={1}>{primarySharedEvent?.name ?? "Event Friends"}</Text>
          </View>
          <Text style={styles.eventFriendsLaunchCount}>{activeEvents.length}</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
        </Pressable>
      ) : null}

      <View style={styles.deckArea}>
        <DeckBackdrop />
        {nextProfile && (
          <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.deckLayer, { transform: [{ scale: nextScale }] }]}>
            <DeckCard data={toDeckCard(nextProfile, selectedInterests)} mode={deckMode} />
          </Animated.View>
        )}
        <Animated.View
          key={profileKey}
          {...panResponder.panHandlers}
          accessibilityActions={[
            { name: "activate", label: "Otwórz szczegóły profilu" },
            { name: "decrement", label: "Pomiń profil" },
            { name: "increment", label: "Polub profil" }
          ]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === "decrement") void runSwipeAction("pass");
            else if (nativeEvent.actionName === "increment") void runSwipeAction("like");
            else setPreviewOpen(true);
          }}
          style={[styles.deckLayer, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: swipeRotate }] }]}
        >
          <DeckCard data={toDeckCard(profile, selectedInterests)} mode={deckMode} stamps={stamps} onOpenDetails={() => setPreviewOpen(true)} onReport={() => setReportOpen(true)} />
        </Animated.View>
        <View pointerEvents="box-none" style={styles.deckActionDock}>
          <GlassActionBar
            mode={deckMode}
            disabled={swipeBusy}
            items={[
              { key: "pass", label: "Pomiń", icon: "close", onPress: () => void runSwipeAction("pass") },
              { key: "spark", label: hasPro ? `Spark ${superlikesRemaining}` : "SparkLike", icon: "fire", locked: !hasPro, onPress: () => void promptProFeature("superlike", () => runSwipeAction("superlike"), !hasPro) },
              { key: "chat", label: premiumChatLabel === "Napisz teraz" ? "Napisz" : premiumChatLabel, icon: "chat-outline", locked: !hasPro && !hasMatchedProfile, onPress: () => void promptProFeature("message", handlePremiumChat, !hasPro && !hasMatchedProfile) },
              { key: "like", label: "Polub", icon: "heart", primary: true, onPress: () => void runSwipeAction("like") }
            ] satisfies ActionItem[]}
          />
        </View>
        {sponsored}
        {swipeFeedback && (
          <View pointerEvents="none" style={styles.swipeFeedback}>
            <MaterialCommunityIcons name="check-circle" size={17} color="#fff" />
            <Text style={styles.swipeFeedbackText}>{swipeFeedback}</Text>
          </View>
        )}
      </View>

      {previewOpen && (
        <ProfilePreviewSheet
          profile={profile}
          viewerInterests={selectedInterests}
          onClose={() => setPreviewOpen(false)}
          onLike={handlePreviewLike}
          onMessage={handlePreviewMessage}
          onSuperlike={handlePreviewSuperlike}
          canViewSocials={hasMatchedProfile}
          messageLocked={!hasPro && !hasMatchedProfile}
          superlikeLocked={!hasPro}
          superlikesRemaining={superlikesRemaining}
          relationshipStatus={hasMatchedProfile ? "matched" : hasRequestedProfile ? "requested" : "none"}
        />
      )}

      <DiscoveryMenuModal
        visible={menuOpen}
        filters={discoverFilters}
        onClose={() => setMenuOpen(false)}
        onOpenPreferences={() => setPreferencesOpen(true)}
        onRefresh={onRefresh}
        onOpenMatches={onOpenMatches}
        onOpenMessages={onOpenMessages}
        messageNotificationCount={messageNotificationCount}
        onOpenProfile={onOpenProfile}
        onOpenPremium={onOpenPremium}
        onOpenSafety={onOpenSafety}
        onSignOut={onSignOut}
        onInvite={onInvite}
      />

      <DiscoveryPreferencesModal
        visible={preferencesOpen}
        filters={discoverFilters}
        onClose={() => setPreferencesOpen(false)}
        onApply={onSavePreferences}
      />

      {reportOpen && (
        <View style={styles.reportOverlay}>
          <Pressable style={styles.reportBackdrop} onPress={() => setReportOpen(false)} />
          <View style={styles.reportSheet}>
            <View style={styles.reportSheetHeader}>
              <View style={styles.fill}>
                <Text style={styles.reportTitle} selectable>Zgłoś profil</Text>
                <Text style={styles.reportSubtitle} selectable>{profile.name} {profile.surname} - zgłoszenie trafi bezpośrednio do moderacji</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setReportOpen(false)} style={styles.reportCloseButton}>
                <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>
            <TextInput
              value={reportText}
              onChangeText={setReportText}
              multiline
              textAlignVertical="top"
              placeholder="Opisz problem, np. fałszywy profil, obraźliwe treści, spam..."
              placeholderTextColor={colors.muted}
              style={styles.reportInput}
            />
            <Pressable accessibilityRole="button" onPress={sendReport} style={styles.reportSendButton}>
              <MaterialCommunityIcons name="email-edit" size={18} color="#fff" />
              <Text style={styles.reportSendText}>Wyślij zgłoszenie</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
/** Everything the Discover card shows, derived from a profile. */
function toDeckCard(profile: MatchProfile, viewerInterests: string[]): DeckCardData {
  const insight = getSharedInterestInsights(profile.interests, viewerInterests)[0];
  const interestMatchPercent = Math.max(0, Math.min(100, profile.interestMatchPercent ?? 0));
  const compatibility = getCompatibilityPresentation(profile.compatibilityScore ?? interestMatchPercent);
  const sharedEvent = profile.sharedEvents?.[0];
  const activeEvent = sharedEvent ?? profile.activeEvents?.find(isEventActive);
  const gender = profile.gender && profile.gender !== "unspecified" ? genderOptions.find((option) => option.value === profile.gender)?.label : null;
  return {
    key: getProfileKey(profile),
    name: [profile.name, profile.surname].filter(Boolean).join(" "),
    age: profile.age,
    place: [profile.city, profile.distance && profile.distance !== profile.city ? profile.distance : null].filter(Boolean).join(" · "),
    photos: getProfileGallery(profile),
    chips: getFeaturedInterests(profile),
    verified: profile.verified === true,
    premium: profile.premium === true,
    lgbt: profile.lgbtTag ?? null,
    meta: [sharedEvent || compatibility.score <= 0 ? null : `${compatibility.score}% · ${compatibility.detail}`, gender, profile.intent].filter(Boolean).join(" · "),
    highlight: activeEvent
      ? { icon: activeEvent.icon || "calendar-heart", label: `${sharedEvent ? "Razem na" : "Uczestniczy"}: ${activeEvent.name}` }
      : insight ? { icon: insight.icon, label: formatSharedInterestInsight(insight) } : null
  };
}

function AgeRangeControl({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  const { colors, styles } = useAppTheme();
  const latest = useRef({ min, max });
  latest.current = { min, max };
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (repeat.current) clearInterval(repeat.current); }, []);
  function adjust(side: "min" | "max", delta: number) {
    const current = latest.current;
    if (side === "min") onChange(Math.max(18, Math.min(current.max, current.min + delta)), current.max);
    else onChange(current.min, Math.min(99, Math.max(current.min, current.max + delta)));
  }
  function startRepeat(side: "min" | "max", delta: number) {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = setInterval(() => adjust(side, delta), 70);
  }
  function stopRepeat() {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
  }

  return (
    <View style={styles.ageRangeGrid}>
      {([["Od", "min", min], ["Do", "max", max]] as const).map(([label, side, value]) => (
        <View key={side} style={styles.ageRangeSide}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View style={styles.ageRangeButtons}>
            <Pressable accessibilityRole="button" accessibilityLabel={label + " wiek: mniej"} onPress={() => adjust(side, -1)} onLongPress={() => startRepeat(side, -1)} onPressOut={stopRepeat} delayLongPress={300} style={styles.ageRangeButton}><MaterialCommunityIcons name="minus" size={18} color={colors.ink} /></Pressable>
            <Text style={styles.ageRangeValue}>{value}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={label + " wiek: więcej"} onPress={() => adjust(side, 1)} onLongPress={() => startRepeat(side, 1)} onPressOut={stopRepeat} delayLongPress={300} style={styles.ageRangeButton}><MaterialCommunityIcons name="plus" size={18} color={colors.ink} /></Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function countActiveDiscoverFilters(filters: DiscoverFilters) {
  const defaults = createDefaultDiscoverFilters();
  return [
    filters.ageMin !== defaults.ageMin || filters.ageMax !== defaults.ageMax,
    filters.maxDistanceKm !== defaults.maxDistanceKm,
    filters.targetInterests.length > 0,
    filters.requireCommonInterests,
    !filters.includeProfilesWithoutLocation,
    filters.proOnly,
    filters.lgbtOnly,
    (Object.keys(defaults.targetGendersByIntent) as IntentPreferenceKey[]).some((key) =>
      [...filters.targetGendersByIntent[key]].sort().join(",") !== [...defaults.targetGendersByIntent[key]].sort().join(",")
    )
  ].filter(Boolean).length;
}

function DiscoveryMenuModal({
  visible,
  filters,
  onClose,
  onOpenPreferences,
  onRefresh,
  onOpenMatches,
  onOpenMessages,
  messageNotificationCount,
  onOpenProfile,
  onOpenPremium,
  onOpenSafety,
  onSignOut,
  onInvite
}: {
  visible: boolean;
  filters: DiscoverFilters;
  onClose: () => void;
  onOpenPreferences: () => void;
  onRefresh: () => void;
  onOpenMatches: () => void;
  onOpenMessages: () => void;
  messageNotificationCount: number;
  onOpenProfile: () => void;
  onOpenPremium: (source?: PremiumEntrySource) => void;
  onOpenSafety: () => void;
  onSignOut: () => void;
  onInvite: () => void;
}) {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const activeFilters = countActiveDiscoverFilters(filters);
  const menuItems: Array<{ icon: string; label: string; hint: string; active?: boolean; badge?: number; action: () => void }> = [
    { icon: "cards-heart", label: "Odkrywaj", hint: "Wróć do kart", active: true, action: onClose },
    { icon: "heart-multiple", label: "Matche", hint: "Polubienia i nowe iskry", action: onOpenMatches },
    { icon: "message-text", label: "Wiadomości", hint: messageNotificationCount > 0 ? formatUnreadLabel(messageNotificationCount) : "Aktywne i oczekuj\u0105ce", badge: messageNotificationCount, action: onOpenMessages },
    { icon: "account-circle", label: "Twój profil", hint: "Zdjęcia, dane i zainteresowania", action: onOpenProfile },
    { icon: "account-multiple-plus", label: "Zaproś znajomych", hint: "Wyślij link do Spark", action: onInvite },
    { icon: "crown", label: "Spark Pro", hint: "Pakiety i funkcje premium", action: onOpenPremium }
  ];

  function run(action: () => void) {
    onClose();
    action();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={styles.discoveryModalRoot}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zamknij menu" onPress={onClose} style={styles.discoveryModalBackdrop} />
        <View style={[styles.discoveryDrawer, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.discoveryDrawerHeader}>
            <View style={styles.discoveryDrawerBrand}>
              <View style={styles.discoveryDrawerLogo}><Image source={headerLogoImage} style={styles.discoveryDrawerLogoImage} contentFit="contain" /></View>
              <View style={styles.fill}>
                <Text style={styles.discoveryDrawerEyebrow}>SPARK</Text>
                <Text style={styles.discoveryDrawerTitle}>Twoje centrum</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Zamknij menu" onPress={onClose} style={styles.discoveryDrawerClose}>
              <MaterialCommunityIcons name="close" size={21} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.discoveryDrawerScrollView}
            contentContainerStyle={styles.discoveryDrawerScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          <View style={styles.discoveryDrawerNav}>
            {menuItems.map((item) => (
              <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => run(item.action)} style={({ pressed }) => [styles.discoveryMenuRow, item.active && styles.discoveryMenuRowActive, pressed && styles.controlPressed]}>
                <View style={[styles.discoveryMenuIcon, item.active && styles.discoveryMenuIconActive]}>
                  <MaterialCommunityIcons name={item.icon as any} size={21} color={item.active ? "#fff" : colors.primary} />
                </View>
                <View style={styles.fill}>
                  <Text style={[styles.discoveryMenuLabel, item.active && styles.discoveryMenuLabelActive]}>{item.label}</Text>
                  <Text style={styles.discoveryMenuHint}>{item.hint}</Text>
                </View>
                {Boolean(item.badge) && <View style={styles.discoveryMenuBadge}><Text style={styles.discoveryMenuBadgeText}>{formatBadgeCount(item.badge ?? 0)}</Text></View>}
                {item.active ? <View style={styles.discoveryMenuActiveDot} /> : <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />}
              </Pressable>
            ))}
          </View>

          <View style={styles.discoveryDrawerDivider} />
          <Pressable accessibilityRole="button" onPress={() => run(onOpenPreferences)} style={({ pressed }) => [styles.discoveryMenuUtility, pressed && styles.controlPressed]}>
            <MaterialCommunityIcons name="tune-variant" size={20} color={colors.primary} />
            <View style={styles.fill}><Text style={styles.discoveryMenuLabel}>Preferencje odkrywania</Text><Text style={styles.discoveryMenuHint}>Wiek, dystans i zainteresowania</Text></View>
            {activeFilters > 0 && <View style={styles.discoveryFilterCount}><Text style={styles.discoveryFilterCountText}>{activeFilters}</Text></View>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => run(onRefresh)} style={({ pressed }) => [styles.discoveryMenuUtility, pressed && styles.controlPressed]}>
            <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />
            <View style={styles.fill}><Text style={styles.discoveryMenuLabel}>Odśwież feed</Text><Text style={styles.discoveryMenuHint}>Pobierz profile ponownie</Text></View>
          </Pressable>

          <View style={styles.discoveryDrawerSpacer} />
          <Pressable accessibilityRole="button" onPress={() => run(onSignOut)} style={({ pressed }) => [styles.discoveryMenuUtility, pressed && styles.controlPressed]}>
            <MaterialCommunityIcons name="logout" size={20} color={colors.primary} />
            <View style={styles.fill}><Text style={styles.discoveryMenuLabel}>Wyloguj się</Text><Text style={styles.discoveryMenuHint}>Zakończ sesję na tym urządzeniu</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => run(onOpenSafety)} style={({ pressed }) => [styles.discoverySafetyRow, pressed && styles.controlPressed]}>
            <View style={styles.discoverySafetyIcon}><MaterialCommunityIcons name="shield-check" size={20} color={colors.green} /></View>
            <View style={styles.fill}><Text style={styles.discoveryMenuLabel}>Bezpieczeństwo</Text><Text style={styles.discoveryMenuHint}>Zgłoszenia, blokady i zasady</Text></View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DiscoveryPreferencesModal({
  visible,
  filters,
  onClose,
  onApply
}: {
  visible: boolean;
  filters: DiscoverFilters;
  onClose: () => void;
  onApply: (nextFilters: DiscoverFilters) => Promise<boolean>;
}) {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<DiscoverFilters>(() => ({ ...filters, targetInterests: [...filters.targetInterests], targetIntents: [...filters.targetIntents], targetGendersByIntent: normalizeGenderPreferences(filters.targetGendersByIntent) }));
  const [saving, setSaving] = useState(false);
  const activeFilters = countActiveDiscoverFilters(draft);
  // Stored in km; imperial regions get round mile steps (10, 25, 50, 100 mi).
  const distanceOptions = usesImperialDistance() ? [16, 40, 80, 161, 500] : [25, 50, 100, 250, 500];

  useEffect(() => {
    if (visible) {
      setDraft({ ...filters, targetInterests: [...filters.targetInterests], targetIntents: [...filters.targetIntents], targetGendersByIntent: normalizeGenderPreferences(filters.targetGendersByIntent) });
      setSaving(false);
    }
  }, [filters, visible]);

  async function applyFilters() {
    if (saving) return;
    setSaving(true);
    const saved = await onApply(draft);
    setSaving(false);
    if (saved) onClose();
  }

  // Reset filters, but keep the Romantic / Friends choice from the big switch.
  function resetFilters() {
    tap();
    setDraft((current) => ({ ...createDefaultDiscoverFilters(), targetIntents: current.targetIntents }));
  }

  const toggleRow = (label: string, hint: string, value: boolean, onChange: (value: boolean) => void) => (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.fpRow}>
      <View style={styles.fill}>
        <Text style={styles.pfRowLabel}>{label}</Text>
        <Text style={styles.pfRowSub}>{hint}</Text>
      </View>
      <Switch pointerEvents="none" value={value} trackColor={{ false: colors.fillStronger, true: colors.primary }} thumbColor="#fff" />
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={[styles.discoveryModalRoot, styles.discoveryFilterModalRoot, { paddingTop: Math.max(insets.top + 4, 12) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zamknij filtry" onPress={onClose} style={styles.discoveryModalBackdrop} />
        <View style={[styles.fpSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.discoverySheetHandle} />
          <View style={styles.fpHeader}>
            <Pressable accessibilityRole="button" onPress={resetFilters} disabled={saving} hitSlop={8} style={styles.fpHeaderSide}>
              <Text style={[styles.fpHeaderAction, activeFilters === 0 && { color: colors.muted }]}>Resetuj</Text>
            </Pressable>
            <Text style={styles.fpTitle}>Filtry</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Zamknij filtry" onPress={onClose} hitSlop={8} style={[styles.fpHeaderSide, { alignItems: "flex-end" }]}>
              <View style={styles.fpClose}><MaterialCommunityIcons name="close" size={18} color={colors.inkSoft} /></View>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.fpScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.stGroupWrap}>
              <Text style={styles.stGroupTitle}>Kogo pokazywać</Text>
              <View style={[styles.mxGroup, { padding: 14, gap: 10 }]}>
                <GenderPreferencesEditor
                  compact
                  intents={lensFromIntents(draft.targetIntents, []) === "romantic" ? ["Randki"] : ["Znajomi"]}
                  value={draft.targetGendersByIntent}
                  onChange={(targetGendersByIntent) => setDraft((current) => ({
                    ...current,
                    // Older profiles may still carry the "LGBT+ / Społeczność" goal; keep it in step with Friends.
                    targetGendersByIntent: lensFromIntents(current.targetIntents, []) === "romantic"
                      ? targetGendersByIntent
                      : { ...targetGendersByIntent, community: targetGendersByIntent.friends }
                  }))}
                />
              </View>
              <View style={styles.mxGroup}>
                {toggleRow("Tylko osoby LGBT+", "Pokazuje tylko osoby z tagiem LGBT+.", draft.lgbtOnly, (lgbtOnly) => setDraft((current) => ({ ...current, lgbtOnly })))}
              </View>
              <Text style={styles.stFooter}>Romantic, Friends i Event zmieniasz przełącznikiem na górze Odkrywaj.</Text>
            </View>

            <View style={styles.stGroupWrap}>
              <Text style={styles.stGroupTitle}>Wiek</Text>
              <View style={[styles.mxGroup, { padding: 14 }]}>
                <AgeRangeControl min={draft.ageMin} max={draft.ageMax} onChange={(ageMin, ageMax) => setDraft((current) => ({ ...current, ageMin, ageMax }))} />
              </View>
              <Text style={styles.stFooter}>Przytrzymaj + lub −, żeby zmieniać szybciej.</Text>
            </View>

            <View style={styles.stGroupWrap}>
              <Text style={styles.stGroupTitle}>Odległość</Text>
              <View style={[styles.mxGroup, { padding: 12 }]}>
                <View style={styles.fpChips}>
                  {distanceOptions.map((distance) => {
                    const selected = draft.maxDistanceKm === distance;
                    return (
                      <Pressable key={distance} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setDraft((current) => ({ ...current, maxDistanceKm: distance }))} style={[styles.fpChip, selected && styles.fpChipActive]}>
                        <Text style={[styles.fpChipText, selected && styles.fpChipTextActive]}>{distance === 500 ? "Cały kraj" : distanceLimitLabel(distance)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.mxGroup}>
                {toggleRow("Uwzględniaj profile bez lokalizacji", draft.includeProfilesWithoutLocation ? "Gdy w pobliżu nikogo nie ma, pokażemy też dalsze profile." : "Limit odległości jest ścisły — nigdy go nie poszerzamy.", draft.includeProfilesWithoutLocation, (includeProfilesWithoutLocation) => setDraft((current) => ({ ...current, includeProfilesWithoutLocation })))}
              </View>
            </View>

            <View style={styles.stGroupWrap}>
              <Text style={styles.stGroupTitle}>Dopasowanie</Text>
              <View style={styles.mxGroup}>
                {toggleRow("Wspólne zainteresowanie", "Tylko osoby z co najmniej jednym tagiem z Twojego profilu.", draft.requireCommonInterests, (requireCommonInterests) => setDraft((current) => ({ ...current, requireCommonInterests })))}
                <View style={styles.pfDivider} />
                {toggleRow("Tylko Spark Pro", "Tylko osoby z aktywnym Spark Pro.", draft.proOnly, (proOnly) => setDraft((current) => ({ ...current, proOnly })))}
              </View>
            </View>

            <View style={styles.stGroupWrap}>
              <Text style={styles.stGroupTitle}>Szukane zainteresowania{draft.targetInterests.length ? ` · ${draft.targetInterests.length}/10` : ""}</Text>
              <View style={[styles.mxGroup, { padding: 12 }]}>
                <CategorizedInterestPicker selected={draft.targetInterests} onToggle={(item) => setDraft((current) => ({ ...current, targetInterests: toggleListItem(current.targetInterests, item) }))} maxSelected={10} />
              </View>
              <Text style={styles.stFooter}>Opcjonalne. Pokażemy tylko osoby z przynajmniej jednym z wybranych tagów.</Text>
            </View>
          </ScrollView>

          <View style={styles.fpFooter}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void applyFilters()} style={({ pressed }) => [styles.fpApply, saving && styles.primaryButtonDisabled, pressed && styles.controlPressed]}>
              {saving ? <ActivityIndicator size="small" color={colors.onPrimary} /> : null}
              <Text style={styles.fpApplyText}>{saving ? "Zapisywanie…" : "Zastosuj"}</Text>
            </Pressable>
            <Text style={styles.fpCaption}>{activeFilters === 0 ? "Bez dodatkowych filtrów" : activeFilters === 1 ? "1 aktywny filtr" : activeFilters < 5 ? `${activeFilters} aktywne filtry` : `${activeFilters} aktywnych filtrów`}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ProfileCard({ profile, viewerInterests = [], onReport, compact = false }: { profile: MatchProfile; viewerInterests?: string[]; onReport?: () => void; compact?: boolean }) {
  const { styles } = useAppTheme();
  const featuredInterests = getFeaturedInterests(profile);
  const sharedInterestInsights = getSharedInterestInsights(profile.interests, viewerInterests);
  const primarySharedInterestInsight = sharedInterestInsights[0];
  const displayName = [profile.name, profile.surname].filter(Boolean).join(" ");
  const interestMatchPercent = Math.max(0, Math.min(100, profile.interestMatchPercent ?? 0));
  const compatibility = getCompatibilityPresentation(profile.compatibilityScore ?? interestMatchPercent);
  const sharedEvent = profile.sharedEvents?.[0];
  const activeEvent = sharedEvent ?? profile.activeEvents?.find(isEventActive);

  return (
    <View style={[styles.profileCard, activeEvent && styles.profileCardEvent, compact && styles.profileCardCompact]}>
      <Image source={profile.image} style={styles.profileImage} contentFit="cover" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.48)", "rgba(0,0,0,0.94)"]} locations={[0, 0.48, 1]} style={styles.cardShade} />
      {onReport && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zgłoś profil"
          onPress={(event) => {
            event.stopPropagation();
            onReport();
          }}
          style={styles.cardReportButton}
        >
          <MaterialCommunityIcons name="exclamation-thick" size={17} color="#fff" />
        </Pressable>
      )}
      {profile.distance ? (
        <View style={styles.badgeRow}>
          <Text style={styles.badge} numberOfLines={1} maxFontSizeMultiplier={1.15}>{profile.distance}</Text>
        </View>
      ) : null}
      <View style={[styles.profileCopy, compact && styles.profileCopyCompact]}>
        {activeEvent && (
          <View style={styles.cardSharedEvent}>
            <MaterialCommunityIcons name={activeEvent.icon as any} size={13} color="#fff" />
            <Text style={styles.cardSharedEventText} numberOfLines={1}>{sharedEvent ? "Razem na" : "Uczestniczy"}: {activeEvent.name}</Text>
            <Text style={styles.cardSharedEventDate}>{formatEventDate(activeEvent)}</Text>
          </View>
        )}
        <View style={styles.profileStatusRow}>
          {profile.premium && (
            <View style={styles.cardProBadge}>
              <MaterialCommunityIcons name="crown" size={12} color="#3a2500" />
              <Text style={styles.cardProText} maxFontSizeMultiplier={1.15}>SPARK PRO</Text>
            </View>
          )}
          {profile.verified && <Pressable accessibilityRole="button" accessibilityLabel="Profil zweryfikowany" onPress={showVerifiedProfileInfo} style={styles.cardVerifiedBadge}><MaterialCommunityIcons name="check-decagram" size={13} color="#63d7ff" /><Text style={styles.cardVerifiedText}>ZWERYFIKOWANY</Text></Pressable>}
          {!sharedEvent && <Pressable accessibilityRole="button" accessibilityLabel={"Zgodność " + compatibility.score + " procent, " + compatibility.label} accessibilityHint="Wyjaśnia sposób obliczania zgodności" onPress={() => showCompatibilityInfo(compatibility.score, interestMatchPercent, primarySharedInterestInsight)} style={[styles.matchInlinePill, { backgroundColor: compatibility.background, borderColor: compatibility.border }]}><MaterialCommunityIcons name={compatibility.icon} size={13} color={compatibility.color} /><Text style={[styles.matchInlinePillText, { color: compatibility.color }]} maxFontSizeMultiplier={1.15}>{compatibility.score}% · {compatibility.label}</Text></Pressable>}
        </View>
        <Text
          style={styles.cardTitle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          maxFontSizeMultiplier={1.15}
        >
          {displayName}, {profile.age}
        </Text>
        {!sharedEvent && <View style={styles.cardContextRow}>
          <MaterialCommunityIcons name={genderOptions.find((option) => option.value === profile.gender)?.icon ?? "account-question-outline"} size={13} color="#ff8cbc" />
          {profile.gender && profile.gender !== "unspecified" ? <Text style={styles.cardContextText} numberOfLines={1}>{genderOptions.find((option) => option.value === profile.gender)?.label}</Text> : null}
          <MaterialCommunityIcons name="map-marker-outline" size={13} color="#ff8cbc" />
          <Text style={styles.cardContextText} numberOfLines={1}>{[profile.city, profile.country].filter(Boolean).join(", ")}</Text>
          {profile.intent ? <View style={styles.cardContextDot} /> : null}
          {profile.intent ? <Text style={styles.cardContextText} numberOfLines={1}>{profile.intent}</Text> : null}
        </View>}
        {!sharedEvent && <View style={styles.featuredInterestRow}>
          {featuredInterests.map((interest, index) => {
            const theme = getInterestTheme(interest, index);
            return (
              <View key={interest} style={[styles.featuredInterestPill, { backgroundColor: theme.soft, borderColor: theme.border }]}>
                <MaterialCommunityIcons name="star-four-points" size={12} color={theme.active} />
                <Text style={styles.featuredInterestText} numberOfLines={1} maxFontSizeMultiplier={1.15}>{interest}</Text>
              </View>
            );
          })}
        </View>}
        {!sharedEvent && primarySharedInterestInsight && (
          <View style={styles.cardAffinityInsight}>
            <MaterialCommunityIcons name={primarySharedInterestInsight.icon as any} size={14} color="#ff9ac8" />
            <Text style={styles.cardAffinityInsightText} numberOfLines={1} maxFontSizeMultiplier={1.15}>{formatSharedInterestInsight(primarySharedInterestInsight)}</Text>
          </View>
        )}
        <Text style={styles.cardBio} numberOfLines={1} maxFontSizeMultiplier={1.15}>{profile.bio}</Text>
      </View>
    </View>
  );
}
function ProfilePreviewSheet({
  profile,
  viewerInterests,
  onClose,
  onLike,
  onMessage,
  onSuperlike,
  canViewSocials,
  messageLocked = false,
  superlikeLocked = false,
  superlikesRemaining = 0,
  relationshipStatus = "none",
  isOwnProfile = false,
  readOnly = false,
  blocked = false
}: {
  profile: MatchProfile;
  viewerInterests: string[];
  onClose: () => void;
  onLike?: () => void;
  onMessage?: () => void;
  onSuperlike?: () => void;
  canViewSocials: boolean;
  messageLocked?: boolean;
  superlikeLocked?: boolean;
  superlikesRemaining?: number;
  relationshipStatus?: "none" | "liked" | "requested" | "matched";
  isOwnProfile?: boolean;
  readOnly?: boolean;
  blocked?: boolean;
}) {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [bioExpanded, setBioExpanded] = useState(false);
  const photos = getProfileGallery(profile);
  const featuredInterests = getFeaturedInterests(profile);
  const visibleInterests = profile.interests.slice(0, 8);
  const sharedInterests = profile.interests.filter((interest) => viewerInterests.includes(interest));
  const sharedInterestInsights = getSharedInterestInsights(profile.interests, viewerInterests);
  const primarySharedInterestInsight = sharedInterestInsights[0];
  const overlapBase = Math.max(1, Math.min(viewerInterests.length, profile.interests.length));
  const calculatedInterestMatch = viewerInterests.length > 0 ? Math.round((sharedInterests.length / overlapBase) * 100) : 0;
  const interestMatchPercent = Math.max(0, Math.min(100, profile.interestMatchPercent ?? calculatedInterestMatch));
  const hasInterestMatch = viewerInterests.length > 0 || typeof profile.interestMatchPercent === "number";
  const compatibility = getCompatibilityPresentation(profile.compatibilityScore ?? interestMatchPercent);
  const displayName = [profile.name, profile.surname].filter(Boolean).join(" ");
  const locationLabel = [profile.city, profile.country].filter(Boolean).join(", ");
  const normalizedDistance = profile.distance.trim().toLocaleLowerCase("pl");
  const normalizedLocation = locationLabel.trim().toLocaleLowerCase("pl");
  const secondaryDistance =
    profile.distance && normalizedDistance !== normalizedLocation && normalizedDistance !== profile.city.trim().toLocaleLowerCase("pl")
      ? profile.distance
      : null;
  const distanceFact = secondaryDistance ?? (locationLabel || "Lokalizacja ukryta");
  const bioNeedsToggle = profile.bio.trim().length > 125;
  const photoWidth = Math.min(width - 24, 500);
  const compactScreen = width < 380;
  const sharedEvent = profile.sharedEvents?.[0];
  const activeEvent = sharedEvent ?? profile.activeEvents?.find(isEventActive);
  const recordedProfileKeyRef = useRef<string | null>(null);
  const isMatchedRelationship = relationshipStatus === "matched";
  const isRequestedRelationship = relationshipStatus === "requested";
  const isLikedRelationship = relationshipStatus === "liked";

  useEffect(() => {
    const profileKey = getProfileKey(profile);
    if (isOwnProfile || profile.isTestProfile || recordedProfileKeyRef.current === profileKey) return;
    recordedProfileKeyRef.current = profileKey;
    void recordCurrentUserProfileView(profileKey).catch(() => undefined);
  }, [isOwnProfile, profile]);

  const genderLabel = genderOptions.find((option) => option.value === profile.gender)?.label;
  const facts = [genderLabel, locationLabel || "Lokalizacja ukryta", secondaryDistance, profile.heightCm ? formatHeight(profile.heightCm) : null].filter(Boolean).join(" · ");
  const orderedInterests = [...visibleInterests].sort((left, right) => Number(sharedInterests.includes(right)) - Number(sharedInterests.includes(left)));
  const hairline = StyleSheet.hairlineWidth;
  const infoRows: Array<{ key: string; icon: string; tint?: string; label: string; sub?: string; value?: string; onPress?: () => void }> = [];
  if (blocked) infoRows.push({ key: "blocked", icon: "account-cancel", tint: "#ff4d6d", label: "Profil zablokowany", sub: "Ta osoba nie widzi Twojego profilu i nie może do Ciebie pisać." });
  if (activeEvent) infoRows.push({
    key: "event",
    icon: activeEvent.icon,
    label: activeEvent.name,
    sub: (sharedEvent ? "Wspólny plan · " : "Idzie na wydarzenie · ") + formatEventDateRange(activeEvent) + " · " + activeEvent.city,
    value: sharedEvent && profile.sharedEvents && profile.sharedEvents.length > 1 ? "+" + (profile.sharedEvents.length - 1) : undefined
  });
  if (!isOwnProfile && !sharedEvent && hasInterestMatch && compatibility.score > 0) infoRows.push({
    key: "match",
    icon: "chart-donut",
    label: "Zgodność",
    sub: compatibility.label.charAt(0).toLocaleUpperCase("pl-PL") + compatibility.label.slice(1).toLocaleLowerCase("pl-PL"),
    value: compatibility.score + "%",
    onPress: () => showCompatibilityInfo(compatibility.score, interestMatchPercent, primarySharedInterestInsight)
  });
  if (!isOwnProfile && !sharedEvent && primarySharedInterestInsight) infoRows.push({
    key: "vibe",
    icon: primarySharedInterestInsight.icon,
    label: formatSharedInterestInsight(primarySharedInterestInsight),
    sub: primarySharedInterestInsight.interests.length > 1 ? primarySharedInterestInsight.interests.join(" · ") : "Dobry temat na pierwszą wiadomość"
  });

  const local = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    close: { position: "absolute", left: 26, zIndex: 20, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.38)" },
    content: { gap: 28, paddingHorizontal: 12 },
    gallery: { alignSelf: "center", overflow: "hidden", borderRadius: 28, backgroundColor: colors.photoPlaceholder },
    progress: { position: "absolute", left: 14, right: 14, bottom: 12, flexDirection: "row", gap: 4 },
    progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.38)" },
    progressBarActive: { backgroundColor: "#fff" },
    identity: { gap: 4, paddingHorizontal: 6, marginTop: -6 },
    ownHint: { color: colors.primary, fontSize: 13, fontWeight: "600" },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    title: { flexShrink: 1, color: colors.ink, fontSize: compactScreen ? 28 : 32, lineHeight: compactScreen ? 34 : 39, fontWeight: "700", letterSpacing: -0.6 },
    facts: { color: colors.muted, fontSize: 15, lineHeight: 21, fontWeight: "500" },
    group: { borderRadius: 18, backgroundColor: colors.surfaceStrong, overflow: "hidden" },
    row: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
    rowIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
    rowLabel: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: "500" },
    rowSub: { marginTop: 1, color: colors.muted, fontSize: 13, lineHeight: 17 },
    rowValue: { color: colors.muted, fontSize: 15, fontWeight: "500", fontVariant: ["tabular-nums"] },
    divider: { height: hairline, marginLeft: 56, backgroundColor: colors.line },
    section: { gap: 10, paddingHorizontal: 6 },
    sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
    caption: { color: colors.muted, fontSize: 13, fontWeight: "500" },
    bio: { color: colors.ink, fontSize: 16, lineHeight: 23, fontWeight: "400" },
    more: { color: colors.primary, fontSize: 15, fontWeight: "600" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: colors.fill },
    chipShared: { backgroundColor: colors.primarySoft },
    chipText: { color: colors.ink, fontSize: 14, fontWeight: "500" },
    chipTextShared: { color: colors.primary, fontWeight: "600" },
    socialIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    actions: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: hairline, borderTopColor: colors.line },
    round: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: colors.fillStrong },
    roundBadge: { position: "absolute", top: -3, right: -3, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink },
    roundBadgeText: { color: colors.background, fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
    primary: { flex: 1, height: 54, borderRadius: 27, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary },
    primaryText: { color: colors.onPrimary, fontSize: 17, fontWeight: "600" },
    quiet: { flex: 1, height: 54, borderRadius: 27, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.fill },
    quietText: { color: colors.inkSoft, fontSize: 16, fontWeight: "600" }
  });

  const renderBadge = (locked: boolean, count?: number) => locked
    ? <View style={local.roundBadge}><MaterialCommunityIcons name="lock" size={11} color={colors.background} /></View>
    : typeof count === "number" ? <View style={local.roundBadge}><Text style={local.roundBadgeText}>{count}</Text></View> : null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={local.root}>
        <StatusBar style={colors.statusBar} />
        <Pressable accessibilityRole="button" accessibilityLabel="Zamknij profil" onPress={onClose} hitSlop={10} style={[local.close, { top: Math.max(insets.top, 10) + 18 }]}>
          <MaterialCommunityIcons name="chevron-down" size={24} color="#fff" />
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            local.content,
            { paddingTop: Math.max(insets.top, 10) + 8, paddingBottom: Math.max(insets.bottom, 10) + (isOwnProfile || readOnly ? 24 : 96) }
          ]}
        >
          <View style={[local.gallery, { width: photoWidth }]}>
            <ScrollView
              horizontal
              pagingEnabled
              bounces={false}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / photoWidth))}
            >
              {photos.map((photo, index) => (
                <Image key={index} source={photo} style={{ width: photoWidth, aspectRatio: 4 / 5, backgroundColor: colors.photoPlaceholder }} contentFit="cover" transition={180} accessibilityLabel={"Zdjęcie " + (index + 1) + " z " + photos.length} />
              ))}
            </ScrollView>
            {photos.length > 1 && (
              <View pointerEvents="none" style={local.progress}>
                {photos.map((_, index) => <View key={index} style={[local.progressBar, index === photoIndex && local.progressBarActive]} />)}
              </View>
            )}
          </View>

          <View style={local.identity}>
            {isOwnProfile && <Text style={local.ownHint}>Tak widzą Cię inni</Text>}
            <View style={local.nameRow}>
              <Text style={local.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} maxFontSizeMultiplier={1.15}>{displayName}, {profile.age}</Text>
              {profile.verified && (
                <Pressable accessibilityRole="button" accessibilityLabel="Profil zweryfikowany" onPress={showVerifiedProfileInfo} hitSlop={8}>
                  <MaterialCommunityIcons name="check-decagram" size={22} color="#0a84ff" />
                </Pressable>
              )}
              {profile.premium && <MaterialCommunityIcons accessibilityLabel="Spark Pro" name="crown" size={20} color={colors.gold} />}
            </View>
            <Text style={local.facts} maxFontSizeMultiplier={1.2}>{facts}</Text>
          </View>

          {infoRows.length > 0 && (
            <View style={local.group}>
              {infoRows.map((row, index) => {
                const content = (
                  <>
                    <View style={[local.rowIcon, row.tint ? { backgroundColor: row.tint + "22" } : null]}>
                      <MaterialCommunityIcons name={row.icon as any} size={17} color={row.tint ?? colors.primary} />
                    </View>
                    <View style={styles.fill}>
                      <Text style={[local.rowLabel, row.tint ? { color: row.tint } : null]} numberOfLines={2}>{row.label}</Text>
                      {row.sub ? <Text style={local.rowSub} numberOfLines={2}>{row.sub}</Text> : null}
                    </View>
                    {row.value ? <Text style={local.rowValue}>{row.value}</Text> : null}
                    {row.onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} /> : null}
                  </>
                );
                return (
                  <React.Fragment key={row.key}>
                    {index > 0 && <View style={local.divider} />}
                    {row.onPress
                      ? <Pressable accessibilityRole="button" onPress={row.onPress} style={({ pressed }) => [local.row, pressed && { backgroundColor: colors.fill }]}>{content}</Pressable>
                      : <View style={local.row}>{content}</View>}
                  </React.Fragment>
                );
              })}
            </View>
          )}

          {profile.bio.trim().length > 0 && (
            <View style={local.section}>
              <Text style={local.sectionTitle}>O mnie</Text>
              <Text style={local.bio} numberOfLines={bioExpanded ? undefined : 4} maxFontSizeMultiplier={1.2}>{profile.bio}</Text>
              {bioNeedsToggle && (
                <Pressable accessibilityRole="button" onPress={() => setBioExpanded((value) => !value)} hitSlop={8} style={{ alignSelf: "flex-start" }}>
                  <Text style={local.more}>{bioExpanded ? "Mniej" : "Więcej"}</Text>
                </Pressable>
              )}
            </View>
          )}

          {orderedInterests.length > 0 && (
            <View style={local.section}>
              <View style={local.sectionHeader}>
                <Text style={local.sectionTitle}>Zainteresowania</Text>
                <Text style={local.caption}>
                  {isOwnProfile ? "Pierwsze trzy widać na karcie" : sharedInterests.length > 0 ? sharedInterests.length + " wspólne" : ""}
                </Text>
              </View>
              <View style={local.chips}>
                {orderedInterests.map((interest) => {
                  const shared = !isOwnProfile && sharedInterests.includes(interest);
                  return (
                    <View key={interest} style={[local.chip, shared && local.chipShared]}>
                      <MaterialCommunityIcons name={(shared ? "check" : getInterestIcon(interest, "tag-outline")) as any} size={15} color={shared ? colors.primary : colors.muted} />
                      <Text style={[local.chipText, shared && local.chipTextShared]} numberOfLines={1} maxFontSizeMultiplier={1.15}>{interest}</Text>
                    </View>
                  );
                })}
              </View>
              {profile.interests.length > visibleInterests.length && (
                <Text style={local.caption}>i {profile.interests.length - visibleInterests.length} więcej</Text>
              )}
            </View>
          )}

          {profile.socials.length > 0 && (
            <View style={local.section}>
              <View style={local.sectionHeader}>
                <Text style={local.sectionTitle}>Social media</Text>
                {!canViewSocials && <Text style={local.caption}>Widoczne po matchu</Text>}
              </View>
              <View style={local.group}>
                {profile.socials.map((social, index) => {
                  const socialTheme = getSocialIcon(social.label);
                  return (
                    <React.Fragment key={social.label}>
                      {index > 0 && <View style={local.divider} />}
                      <View style={local.row}>
                        <View style={[local.socialIcon, { backgroundColor: socialTheme.backgroundColor }]}><SocialIcon label={social.label} size={17} /></View>
                        <Text style={[local.rowLabel, styles.fill]}>{social.label}</Text>
                        {canViewSocials
                          ? <Text style={local.rowValue} numberOfLines={1}>{formatSocialHandle(social.value)}</Text>
                          : <MaterialCommunityIcons name="lock" size={16} color={colors.muted} />}
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        {!isOwnProfile && !readOnly && (
          <GlassSurface style={[local.actions, { paddingBottom: Math.max(insets.bottom, 12) }]} intensity={60}>
            {isMatchedRelationship ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Otwórz chat" onPress={onMessage} style={({ pressed }) => [local.primary, pressed && styles.controlPressed]}>
                <MaterialCommunityIcons name="message-text" size={20} color={colors.onPrimary} />
                <Text style={local.primaryText}>Otwórz chat</Text>
              </Pressable>
            ) : isRequestedRelationship ? (
              <View style={local.quiet}>
                <MaterialCommunityIcons name="clock-outline" size={19} color={colors.inkSoft} />
                <Text style={local.quietText}>Prośba wysłana</Text>
              </View>
            ) : (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel={"Wyślij SparkLike" + (superlikeLocked ? ", wymaga Spark Pro" : ", zostało " + superlikesRemaining)} onPress={onSuperlike} style={({ pressed }) => [local.round, pressed && styles.controlPressed]}>
                  <MaterialCommunityIcons name="fire" size={24} color={colors.primary} />
                  {renderBadge(superlikeLocked, superlikesRemaining)}
                </Pressable>
                {isLikedRelationship ? (
                  <View style={local.quiet}>
                    <MaterialCommunityIcons name="heart" size={19} color={colors.primary} />
                    <Text style={local.quietText}>Polubiono</Text>
                  </View>
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel="Polub profil" onPress={onLike} style={({ pressed }) => [local.primary, pressed && styles.controlPressed]}>
                    <MaterialCommunityIcons name="heart" size={20} color={colors.onPrimary} />
                    <Text style={local.primaryText}>Polub</Text>
                  </Pressable>
                )}
                {onMessage && (
                  <Pressable accessibilityRole="button" accessibilityLabel={"Napisz pierwszą wiadomość" + (messageLocked ? ", wymaga Spark Pro" : "")} onPress={onMessage} style={({ pressed }) => [local.round, pressed && styles.controlPressed]}>
                    <MaterialCommunityIcons name="message-outline" size={23} color={colors.ink} />
                    {renderBadge(messageLocked)}
                  </Pressable>
                )}
              </>
            )}
          </GlassSurface>
        )}
      </View>
    </Modal>
  );
}
function SwipeFab({
  label,
  sublabel,
  icon,
  onPress,
  primary = false,
  large = false,
  small = false,
  locked = false
}: {
  label: string;
  sublabel?: string;
  icon: string;
  onPress: () => void;
  primary?: boolean;
  large?: boolean;
  small?: boolean;
  locked?: boolean;
}) {
  const { colors, styles } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.swipeFabButton}>
      <View style={[styles.swipeFabIcon, small && styles.swipeFabIconSmall, large && styles.swipeFabIconLarge, primary && styles.swipeFabIconPrimary]}>
        <MaterialCommunityIcons name={icon as any} size={large ? 30 : small ? 19 : 23} color={primary ? "#fff" : colors.ink} />
        {locked && (
          <View style={styles.swipeFabLock}>
            <MaterialCommunityIcons name="lock" size={10} color="#fff" />
          </View>
        )}
      </View>
      <Text style={[styles.swipeFabLabel, primary && styles.swipeFabLabelPrimary]} numberOfLines={1}>{label}</Text>
      {sublabel && <Text style={styles.swipeFabSublabel} numberOfLines={1}>{sublabel}</Text>}
    </Pressable>
  );
}

function EventEmptyAnimation({ compact = false }: { compact?: boolean }) {
  const { colors } = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const orbitSize = compact ? 76 : 104;
  return (
    <Animated.View
      style={{
        width: orbitSize,
        height: orbitSize,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        backgroundColor: "rgba(255,45,141,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,45,141,0.18)",
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
        transform: [
          { translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [3, -5] }) },
          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }
        ]
      }}
    >
      <View style={{ width: compact ? 48 : 62, height: compact ? 48 : 62, alignItems: "center", justifyContent: "center", borderRadius: compact ? 17 : 22, backgroundColor: colors.primarySoft }}>
        <MaterialCommunityIcons name="calendar-heart" size={compact ? 25 : 32} color={colors.primary} />
      </View>
    </Animated.View>
  );
}

function EventFriendsManagerModal({
  visible,
  events,
  availableEvents,
  userCity,
  userCountry = "",
  userCountryCode = "PL",
  expiredCount,
  canManage,
  catalogLoading,
  catalogError,
  onClose,
  onSave,
  onCreate,
  onDelete,
  eventDetails,
  proposals,
  proposalsLoading,
  proposalsError,
  onReloadProposals,
  onReloadCatalog,
  onPropose,
  onReviewProposal,
  onWithdrawProposal
}: {
  eventDetails: Record<string, EventDetails>;
  proposals: EventProposal[];
  proposalsLoading: boolean;
  proposalsError: string | null;
  onReloadProposals: () => void;
  onReloadCatalog: () => void;
  onPropose: (event: SparkEvent, details: EventDetails) => Promise<boolean>;
  onReviewProposal: (proposal: EventProposal, status: "approved" | "rejected", event?: SparkEvent, details?: EventDetails) => Promise<boolean>;
  onWithdrawProposal: (proposal: EventProposal) => Promise<boolean>;
  visible: boolean;
  events: SparkEvent[];
  availableEvents: SparkEvent[];
  userCity: string;
  userCountry?: string;
  userCountryCode?: string;
  expiredCount: number;
  canManage: boolean;
  catalogLoading: boolean;
  catalogError: string | null;
  onClose: () => void;
  onSave: (events: SparkEvent[]) => Promise<boolean>;
  onCreate: (event: SparkEvent, details: EventDetails) => Promise<boolean>;
  onDelete: (event: SparkEvent) => Promise<boolean>;
}) {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const eventFormScrollRef = useRef<ScrollView>(null);
  const [draftEvents, setDraftEvents] = useState<SparkEvent[]>(events);
  const [category, setCategory] = useState<EventCategoryId>("music");
  const [selectedIcon, setSelectedIcon] = useState<EventIconId>(getEventCategoryDefaultIcon("music"));
  const [name, setName] = useState("");
  const [city, setCity] = useState(userCity || "");
  const defaults = useMemo(() => getDefaultEventDateTimes(), [visible]);
  const [startsAtInput, setStartsAtInput] = useState(defaults.start);
  const [endsAtInput, setEndsAtInput] = useState(defaults.end);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [editingProposal, setEditingProposal] = useState<EventProposal | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [iconsOpen, setIconsOpen] = useState(false);
  const [view, setView] = useState<"discover" | "mine" | "add">("discover");
  const [query, setQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const createInFlight = useRef(false);
  const saveInFlight = useRef(false);
  const wasVisible = useRef(false);
  // Odkrywaj shows the user's city first; the country scope widens it to every
  // event in the user's country. Events from before country codes are Polish.
  const cityKey = searchKey(userCity.trim());
  const [scope, setScope] = useState<"city" | "country">("city");
  const effectiveScope = cityKey ? scope : "country";
  const inUserCountry = (event: SparkEvent) => (eventDetails[event.id]?.countryCode ?? "PL") === userCountryCode;
  const countryEvents = availableEvents.filter(inUserCountry);
  const countryLabel = userCountry.trim() || "Cały kraj";
  const inUserCity = (event: SparkEvent) => {
    const eventCityKey = searchKey(event.city);
    if (!cityKey || !eventCityKey) return false;
    return eventCityKey === cityKey || (Math.min(eventCityKey.length, cityKey.length) >= 4 && (eventCityKey.includes(cityKey) || cityKey.includes(eventCityKey)));
  };
  const cityEventCount = countryEvents.filter(inUserCity).length;
  const visibleEvents = availableEvents
    .filter((event) => (view !== "mine" || draftEvents.some((item) => item.id === event.id))
      && (view !== "discover" || (inUserCountry(event) && (effectiveScope === "country" || inUserCity(event))))
      && searchKey(`${event.name} ${event.city} ${eventDetails[event.id]?.venue ?? ""}`).includes(searchKey(query)))
    .sort((a, b) => Number(inUserCity(b)) - Number(inUserCity(a)));
  const local = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
    close: { width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.fillStrong },
    eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
    title: { marginTop: 2, color: colors.ink, fontSize: 21, fontWeight: "900" },
    counter: { minWidth: 38, height: 30, paddingHorizontal: 9, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
    counterText: { color: colors.primaryDeep, fontSize: 11, fontWeight: "900" },
    scroll: { gap: 18, padding: 16, paddingBottom: 30 },
    intro: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" },
    hero: { overflow: "hidden", padding: 16, borderRadius: 20, backgroundColor: "rgba(255,45,141,0.11)", borderWidth: 1, borderColor: "rgba(255,45,141,0.26)" },
    heroEyebrow: { color: colors.primaryDeep, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
    heroTitle: { marginTop: 6, color: colors.ink, fontSize: 19, lineHeight: 24, fontWeight: "900" },
    heroText: { marginTop: 6, color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: "700" },
    expiry: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderRadius: 14, backgroundColor: "rgba(255,189,89,0.1)", borderWidth: 1, borderColor: "rgba(255,189,89,0.2)" },
    expiryText: { flex: 1, color: "#f6ce8a", fontSize: 11, lineHeight: 16, fontWeight: "800" },
    sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
    activeList: { gap: 8 },
    activeRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 16, backgroundColor: "rgba(255,45,141,0.08)", borderWidth: 1, borderColor: "rgba(255,45,141,0.18)" },
    activeIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
    activeTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
    meta: { marginTop: 3, color: colors.muted, fontSize: 10, fontWeight: "700" },
    remove: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
    suggestionList: { gap: 8 },
    suggestion: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 18, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.fillStronger },
    suggestionActive: { backgroundColor: "rgba(66,217,130,0.09)", borderColor: "rgba(66,217,130,0.25)" },
    datePill: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,45,141,0.11)" },
    datePillText: { color: colors.primaryDeep, fontSize: 9, fontWeight: "900" },
    participationPill: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: "rgba(255,45,141,0.1)", borderWidth: 1, borderColor: "rgba(255,45,141,0.25)" },
    participationPillActive: { backgroundColor: colors.green, borderColor: colors.green },
    participationText: { color: colors.primaryDeep, fontSize: 9, fontWeight: "900" },
    participationTextActive: { color: "#062817" },
    emptyWrap: { minHeight: 260, alignItems: "center", justifyContent: "center", padding: 22, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
    emptyOrbit: { width: 104, height: 104, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(255,45,141,0.08)", borderWidth: 1, borderColor: "rgba(255,45,141,0.18)" },
    emptyIcon: { width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.primarySoft },
    emptyTitle: { marginTop: 17, color: colors.ink, fontSize: 18, fontWeight: "900", textAlign: "center" },
    emptyText: { marginTop: 7, maxWidth: 300, color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: "700", textAlign: "center" },
    adminPanel: { gap: 12, padding: 15, borderRadius: 20, backgroundColor: "rgba(255,189,89,0.06)", borderWidth: 1, borderColor: "rgba(255,189,89,0.2)" },
    adminBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,189,89,0.13)" },
    adminBadgeText: { color: colors.gold, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
    fieldLabel: { marginBottom: -5, color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
    categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    categoryCard: { width: "48%", flexGrow: 1, minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 16, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.fillStronger },
    categoryActive: { backgroundColor: colors.primarySoft, borderColor: "rgba(255,45,141,0.34)" },
    categoryIcon: { width: 35, height: 35, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,45,141,0.13)" },
    categoryTitle: { color: colors.ink, fontSize: 11, fontWeight: "900" },
    categoryHint: { marginTop: 2, color: colors.muted, fontSize: 9, fontWeight: "700" },
    iconPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    iconChoice: { width: "23%", flexGrow: 1, minWidth: 68, minHeight: 76, alignItems: "center", justifyContent: "center", gap: 7, padding: 8, borderRadius: 16, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.fillStronger },
    iconChoiceActive: { backgroundColor: "rgba(255,45,141,0.15)", borderColor: colors.primary },
    iconChoiceGlyph: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,45,141,0.1)" },
    iconChoiceGlyphActive: { backgroundColor: colors.primary },
    iconChoiceLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", textAlign: "center" },
    iconChoiceLabelActive: { color: colors.ink },
    segment: { flexDirection: "row", padding: 4, borderRadius: 15, backgroundColor: colors.surfaceStrong },
    segmentButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
    segmentActive: { backgroundColor: colors.primary },
    segmentText: { color: colors.muted, fontSize: 11, fontWeight: "900" },
    segmentTextActive: { color: "#fff" },
    input: { minHeight: 50, paddingHorizontal: 13, borderRadius: 15, color: colors.ink, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.fillStronger, fontSize: 13, fontWeight: "700" },
    inputRow: { flexDirection: "row", gap: 8 },
    inputHalf: { flex: 1 },
    add: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary },
    addText: { color: "#fff", fontSize: 12, fontWeight: "900" },
    adminDelete: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,77,109,0.11)" },
    footer: { flexDirection: "row", gap: 9, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
    footerButton: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: colors.fillStrong },
    saveButton: { flex: 1.5, flexDirection: "row", gap: 8, backgroundColor: colors.primary },
    footerText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
    saveText: { color: "#fff" },
    description: { marginTop: 4, color: colors.inkSoft, fontSize: 11, lineHeight: 16, fontWeight: "600" },
    textArea: { minHeight: 92, paddingTop: 13, textAlignVertical: "top" },
    proposalList: { gap: 8 },
    proposalRow: { gap: 10, padding: 13, borderRadius: 18, backgroundColor: colors.fill, borderWidth: 1, borderColor: colors.fillStrong },
    proposalTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    statusPill: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
    proposalActions: { flexDirection: "row", gap: 8 },
    proposalButton: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 13, backgroundColor: colors.fillStrong },
    proposalButtonPrimary: { backgroundColor: colors.primary },
    proposalButtonText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
    proposalButtonTextPrimary: { color: colors.onPrimary }
  });
  const proposalStatus = {
    pending: { label: "CZEKA NA AKCEPTACJĘ", color: colors.gold },
    approved: { label: "ZAAKCEPTOWANE", color: colors.green },
    rejected: { label: "ODRZUCONE", color: "#ff4d6d" }
  } as const;

  useEffect(() => {
    const catalogIds = new Set(availableEvents.map((event) => event.id));
    if (visible && !wasVisible.current) {
      setDraftEvents(sanitizeActiveEvents(events).filter((event) => catalogIds.has(event.id)));
    } else if (visible && !catalogLoading && !catalogError) {
      setDraftEvents((current) => current.filter((event) => catalogIds.has(event.id)));
    }
    wasVisible.current = visible;
  }, [availableEvents, catalogLoading, catalogError, events, visible]);

  function revealEventDateInput() {
    setTimeout(() => eventFormScrollRef.current?.scrollToEnd({ animated: true }), 250);
  }

  function addEvent(event: SparkEvent) {
    if (draftEvents.some((item) => item.id === event.id)) {
      setDraftEvents((current) => current.filter((item) => item.id !== event.id));
      return;
    }
    if (draftEvents.length >= maxSelectedEvents) {
      Alert.alert("Event Friends", `Możesz obserwować maksymalnie ${maxSelectedEvents} wydarzenia jednocześnie.`);
      return;
    }
    setDraftEvents((current) => sanitizeActiveEvents([...current, event]));
    void Haptics.selectionAsync();
  }

  async function addCustomEvent() {
    if (createInFlight.current) return;
    const result = validateEventFields(name, city, startsAtInput, endsAtInput, Date.now(), !!editingProposal);
    const event = result.errors.length === 0
      ? normalizeSparkEvent({ category, icon: selectedIcon, name, city, startsAt: result.startsAt, endsAt: result.endsAt, kind: "specific" }) : null;
    if (!event) {
      setFormError(result.errors.join("\n") || "Sprawdź dane wydarzenia.");
      return;
    }
    createInFlight.current = true; setCreating(true); setFormError(null);
    try {
      // New events belong to the author's country; the catalog and push
      // announcements are scoped by it.
      const details: EventDetails = { venue, description, countryCode: editingProposal?.details.countryCode ?? userCountryCode };
      const created = editingProposal
        ? await onReviewProposal(editingProposal, "approved", event, details)
        : canManage ? await onCreate(event, details) : await onPropose(event, details);
      if (created) {
        cancelEditingProposal();
        setView("mine");
      } else setFormError("Nie udało się zapisać. Szkic jest zachowany — spróbuj ponownie.");
    } catch { setFormError("Nie udało się połączyć. Szkic jest zachowany — spróbuj ponownie."); }
    finally { createInFlight.current = false; setCreating(false); }
  }

  function changeStart(value: string) {
    const previous = parseEventDateTimeInput(startsAtInput), next = parseEventDateTimeInput(value), end = parseEventDateTimeInput(endsAtInput);
    setStartsAtInput(value);
    if (previous && next && end) setEndsAtInput(formatEventDateTimeInput(new Date(Date.parse(next) + Math.max(60000, Date.parse(end) - Date.parse(previous)))));
    setFormError(null);
  }

  function editProposal(proposal: EventProposal) {
    setEditingProposal(proposal);
    setView("add"); setFormError(null);
    setCategory(proposal.event.category);
    setSelectedIcon(proposal.event.icon);
    setName(proposal.event.name);
    setCity(proposal.event.city);
    setStartsAtInput(formatEventDateTimeInput(proposal.event.startsAt));
    setEndsAtInput(formatEventDateTimeInput(proposal.event.endsAt));
    setVenue(proposal.details.venue ?? "");
    setDescription(proposal.details.description ?? "");
    revealEventDateInput();
  }

  function cancelEditingProposal() {
    const nextDefaults = getDefaultEventDateTimes();
    setEditingProposal(null);
    setFormError(null);
    setName("");
    setVenue("");
    setDescription("");
    setStartsAtInput(nextDefaults.start);
    setEndsAtInput(nextDefaults.end);
  }

  function runProposalAction(proposal: EventProposal, action: () => Promise<boolean>) {
    if (reviewingId) return;
    setReviewingId(proposal.id);
    void action().finally(() => setReviewingId(null));
  }

  function rejectProposal(proposal: EventProposal) {
    Alert.alert("Odrzuć zgłoszenie", `Odrzucić „${proposal.event.name}”? Autor dostanie powiadomienie.`, [
      { text: "Anuluj", style: "cancel" },
      { text: "Odrzuć", style: "destructive", onPress: () => runProposalAction(proposal, () => onReviewProposal(proposal, "rejected")) }
    ]);
  }

  function renderProposal(proposal: EventProposal) {
    const status = proposalStatus[proposal.status];
    const busy = reviewingId === proposal.id;
    const meta = eventCategories.find((item) => item.id === proposal.event.category);
    return (
      <View key={proposal.id} style={local.proposalRow}>
        <View style={local.proposalTop}>
          <View style={local.activeIcon}><MaterialCommunityIcons name={proposal.event.icon as any} size={21} color={colors.primary} /></View>
          <View style={styles.fill}>
            <Text style={local.activeTitle} numberOfLines={2}>{proposal.event.name}</Text>
            <Text style={local.meta} numberOfLines={1}>{proposal.details.venue ? proposal.details.venue + " · " : ""}{proposal.event.city} · {meta?.label ?? "Wydarzenie"}</Text>
            <View style={local.datePill}><Text style={local.datePillText}>{formatEventDateRange(proposal.event)}</Text></View>
          </View>
          {busy && <ActivityIndicator color={colors.primary} />}
        </View>
        {proposal.details.description ? <Text style={local.description}>{proposal.details.description}</Text> : null}
        {!canManage && <View style={[local.statusPill, { backgroundColor: status.color + "22" }]}><Text style={[local.statusText, { color: status.color }]}>{status.label}</Text></View>}
        {canManage ? (
          <View style={local.proposalActions}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => rejectProposal(proposal)} style={local.proposalButton}><MaterialCommunityIcons name="close" size={16} color={colors.ink} /><Text style={local.proposalButtonText}>Odrzuć</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => editProposal(proposal)} style={local.proposalButton}><MaterialCommunityIcons name="pencil-outline" size={16} color={colors.ink} /><Text style={local.proposalButtonText}>Edytuj</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => runProposalAction(proposal, () => onReviewProposal(proposal, "approved"))} style={[local.proposalButton, local.proposalButtonPrimary]}><MaterialCommunityIcons name="check" size={16} color={colors.onPrimary} /><Text style={[local.proposalButtonText, local.proposalButtonTextPrimary]}>Zatwierdź</Text></Pressable>
          </View>
        ) : proposal.status === "pending" ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => runProposalAction(proposal, () => onWithdrawProposal(proposal))} style={local.proposalButton}><MaterialCommunityIcons name="undo-variant" size={16} color={colors.ink} /><Text style={local.proposalButtonText}>Wycofaj zgłoszenie</Text></Pressable>
        ) : null}
      </View>
    );
  }

  async function deleteCatalogEvent(event: SparkEvent) {
    if (!canManage || deletingId) return;
    Alert.alert("Usuń wydarzenie", `Usunąć „${event.name}” z katalogu i wyborów użytkowników?`, [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Usuń",
        style: "destructive",
        onPress: () => {
          setDeletingId(event.id);
          void onDelete(event).then((deleted) => {
            if (deleted) setDraftEvents((current) => current.filter((item) => item.id !== event.id));
          }).finally(() => setDeletingId(null));
        }
      }
    ]);
  }

  async function save() {
    if (saveInFlight.current) return;
    saveInFlight.current = true; setSaving(true);
    try { if (await onSave(draftEvents)) onClose(); }
    catch { Alert.alert("Nie udało się zapisać udziału", "Twoje wybory są zachowane. Spróbuj ponownie."); }
    finally { saveInFlight.current = false; setSaving(false); }
  }
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={local.root}>
        <StatusBar style={colors.statusBar} />
        <View style={[local.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zamknij wydarzenia" onPress={onClose} style={local.close}><MaterialCommunityIcons name="chevron-left" size={24} color={colors.ink} /></Pressable>
          <View style={styles.fill}><Text style={local.eyebrow}>Event Friends</Text><Text style={local.title}>Twoje wydarzenia</Text></View>
          <View style={local.counter}><Text style={local.counterText}>{draftEvents.length}/{maxSelectedEvents}</Text></View>
        </View>
        <View style={[local.segment, { marginHorizontal: 16, marginTop: 10 }]}>{([["discover", "Odkrywaj"], ["mine", "Moje"], ["add", "Dodaj"]] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: view === key }} onPress={() => { setView(key); setQuery(""); }} style={[local.segmentButton, view === key && local.segmentActive]}><Text style={[local.segmentText, view === key && local.segmentTextActive]}>{label}</Text></Pressable>)}</View>
        <ScrollView ref={eventFormScrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={local.scroll}>
          {view !== "add" && <>
          <View style={local.hero}>
            <Text style={local.heroEyebrow}>TYMCZASOWE BADGE I FILTRY</Text>
            <Text style={local.heroTitle}>Wybierz wydarzenia, na które idziesz</Text>
            <Text style={local.heroText}>Na profilu pojawi się tymczasowe oznaczenie, a specjalny feed pokaże osoby z tego samego wydarzenia i pasującego wieku. Wybór znika godzinę po zakończeniu.</Text>
          </View>
          {expiredCount > 0 && <View style={local.expiry}><MaterialCommunityIcons name="clock-alert-outline" size={18} color={colors.gold} /><Text style={local.expiryText}>Usunęliśmy {expiredCount} wygasłe wydarzenie{expiredCount === 1 ? "" : "a"}.</Text></View>}
          <Text style={local.sectionTitle}>{view === "mine" ? "Twój udział" : "Aktualne wydarzenia"}</Text>
          {view === "discover" && (cityKey ? (
            <View style={local.segment}>
              {([["city", `${userCity.trim()} (${cityEventCount})`], ["country", `${countryLabel} (${countryEvents.length})`]] as const).map(([key, label]) => (
                <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: effectiveScope === key }} onPress={() => setScope(key)} style={[local.segmentButton, effectiveScope === key && local.segmentActive]}>
                  <Text style={[local.segmentText, effectiveScope === key && local.segmentTextActive]} numberOfLines={1}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={local.intro}>Pokazujemy wydarzenia z całego kraju. Dodaj miasto w profilu, aby najpierw widzieć te w Twojej okolicy.</Text>
          ))}
          <TextInput accessibilityLabel="Szukaj wydarzenia lub miasta" value={query} onChangeText={setQuery} placeholder="Wydarzenie, miasto, miejsce…" placeholderTextColor={colors.muted} style={local.input} />
          {!!query && <Pressable accessibilityRole="button" onPress={() => setQuery("")} style={local.proposalButton}><Text style={local.proposalButtonText}>Wyczyść wyszukiwanie</Text></Pressable>}
          {catalogLoading ? (
            <View style={local.emptyWrap}><ActivityIndicator color={colors.primary} size="large" /><Text style={local.emptyTitle}>Pobieramy wydarzenia</Text></View>
          ) : catalogError ? (
            <View accessibilityRole="alert" style={local.emptyWrap}><Text style={local.emptyTitle}>Nie udało się wczytać wydarzeń</Text><Text style={local.emptyText}>{catalogError}</Text><Pressable accessibilityRole="button" onPress={onReloadCatalog} style={[local.proposalButton, { paddingHorizontal: 16, marginTop: 12, flex: 0, minHeight: 44 }]}><Text style={local.proposalButtonText}>Spróbuj ponownie</Text></Pressable></View>
          ) : visibleEvents.length === 0 ? (
            <View style={local.emptyWrap}>
              <EventEmptyAnimation />
              <Text style={local.emptyTitle}>{query ? "Nie ma takich wydarzeń" : view === "mine" ? "Jeszcze bez planów?" : effectiveScope === "city" ? `Brak wydarzeń: ${userCity.trim()}` : "Brak aktualnych wydarzeń"}</Text>
              <Text style={local.emptyText}>{query ? "Spróbuj innej nazwy lub miasta, także bez polskich znaków." : view === "mine" ? "Wybierz Odkrywaj i dołącz do wydarzenia." : effectiveScope === "city" ? "Zobacz wydarzenia w całym kraju albo dodaj własne." : "Dodaj wydarzenie, na które warto się wybrać."}</Text>
              {view === "discover" && effectiveScope === "city" && countryEvents.length > 0 && (
                <Pressable accessibilityRole="button" onPress={() => setScope("country")} style={[local.proposalButton, { paddingHorizontal: 16, marginTop: 12, flex: 0, minHeight: 44 }]}>
                  <MaterialCommunityIcons name="map-outline" size={17} color={colors.ink} />
                  <Text style={local.proposalButtonText}>Pokaż cały kraj</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={local.suggestionList}>
              {visibleEvents.map((event) => {
                const selected = draftEvents.some((item) => item.id === event.id);
                const meta = eventCategories.find((item) => item.id === event.category);
                return (
                  <Pressable key={event.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => addEvent(event)} style={({ pressed }) => [local.suggestion, selected && local.suggestionActive, pressed && styles.controlPressed]}>
                    <View style={local.activeIcon}><MaterialCommunityIcons name={event.icon as any} size={21} color={selected ? colors.green : colors.primary} /></View>
                    <View style={styles.fill}>
                      <Text style={local.activeTitle} numberOfLines={2}>{event.name}</Text>
                      <Text style={local.meta} numberOfLines={1}>{eventDetails[event.id]?.venue ? eventDetails[event.id]?.venue + " · " : ""}{event.city} · {meta?.label ?? "Wydarzenie"}</Text>
                      {eventDetails[event.id]?.description ? <Text style={local.description} numberOfLines={3}>{eventDetails[event.id]?.description}</Text> : null}
                      <View style={local.datePill}><Text style={local.datePillText}>{formatEventDateRange(event)}</Text></View>
                    </View>
                    {canManage && <Pressable accessibilityRole="button" accessibilityLabel={`Usuń wydarzenie ${event.name}`} onPress={(pressEvent) => { pressEvent.stopPropagation(); void deleteCatalogEvent(event); }} style={local.adminDelete}>{deletingId === event.id ? <ActivityIndicator color="#ff6b85" size="small" /> : <MaterialCommunityIcons name="trash-can-outline" size={17} color="#ff6b85" />}</Pressable>}
                    <View style={[local.participationPill, selected && local.participationPillActive]}><MaterialCommunityIcons name={selected ? "check" : "plus"} size={14} color={selected ? "#062817" : colors.primary} /><Text style={[local.participationText, selected && local.participationTextActive]}>{selected ? "Uczestniczę" : "Dołącz"}</Text></View>
                  </Pressable>
                );
              })}
            </View>
          )}
          </>}
          {view === "mine" && proposalsError && <View accessibilityRole="alert" style={local.proposalRow}><Text style={{ color: colors.ink }}>{proposalsError}</Text><Pressable accessibilityRole="button" onPress={onReloadProposals} style={local.proposalButton}><Text style={local.proposalButtonText}>Ponów pobieranie zgłoszeń</Text></Pressable></View>}
          {view === "mine" && (proposals.length > 0 || proposalsLoading) && (
            <>
              <Text style={local.sectionTitle}>{canManage ? `Zgłoszenia do akceptacji (${proposals.length})` : "Twoje zgłoszenia"}</Text>
              {proposalsLoading && proposals.length === 0 ? <ActivityIndicator color={colors.primary} /> : <View style={local.proposalList}>{proposals.map(renderProposal)}</View>}
            </>
          )}
          {view === "add" && (
            <View style={local.adminPanel}>
              {canManage && <View style={local.adminBadge}><MaterialCommunityIcons name="shield-crown-outline" size={15} color={colors.gold} /><Text style={local.adminBadgeText}>PANEL ORGANIZATORA</Text></View>}
              <Text style={local.sectionTitle}>{editingProposal ? "Edytujesz zgłoszenie" : canManage ? "Opublikuj wydarzenie" : "Zgłoś wydarzenie"}</Text>
              <Text style={local.intro}>{editingProposal
                ? "Popraw dane i zatwierdź. Wydarzenie trafi od razu do katalogu, a autor dostanie powiadomienie."
                : canManage
                  ? "Tylko Twoje konto może publikować eventy. Wydarzenie oraz wybory użytkowników zostaną usunięte godzinę po jego zakończeniu."
                  : "Znasz koncert, mecz albo wystawę? Wyślij zgłoszenie. Po akceptacji pojawi się w Event Friends, a my damy Ci znać powiadomieniem."}</Text>
              {editingProposal && <Pressable accessibilityRole="button" onPress={cancelEditingProposal} style={local.proposalButton}><MaterialCommunityIcons name="close" size={16} color={colors.ink} /><Text style={local.proposalButtonText}>Przerwij edycję</Text></Pressable>}
              <View pointerEvents={creating ? "none" : "auto"} accessibilityState={{ busy: creating }} style={{ gap: 12 }}>
              <View style={local.categoryGrid}>{eventCategories.map((item) => { const selected = category === item.id; return <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={item.label} onPress={() => { setCategory(item.id); setSelectedIcon(getEventCategoryDefaultIcon(item.id)); }} style={({ pressed }) => [local.categoryCard, selected && local.categoryActive, pressed && styles.controlPressed]}><View style={local.categoryIcon}><MaterialCommunityIcons name={item.icon as any} size={19} color={colors.primary} /></View><View style={styles.fill}><Text style={local.categoryTitle}>{item.label}</Text><Text style={local.categoryHint} numberOfLines={1}>{item.hint}</Text></View></Pressable>; })}</View>
              <Text style={local.fieldLabel}>Ikona wydarzenia</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Zmień ikonę wydarzenia" accessibilityState={{ expanded: iconsOpen }} onPress={() => setIconsOpen(!iconsOpen)} style={[local.input, { flexDirection: "row", alignItems: "center", gap: 12 }]}><MaterialCommunityIcons name={selectedIcon as any} size={23} color={colors.primary} /><Text style={{ flex: 1, color: colors.ink }}>{eventIconOptions.find((option) => option.id === selectedIcon)?.label}</Text><MaterialCommunityIcons name={iconsOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} /></Pressable>
              {iconsOpen && <View style={local.iconPicker}>
                {eventIconOptions.map((option) => {
                  const selected = selectedIcon === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Ikona: ${option.label}`}
                      onPress={() => { setSelectedIcon(option.id); setIconsOpen(false); void Haptics.selectionAsync(); }}
                      style={({ pressed }) => [local.iconChoice, selected && local.iconChoiceActive, pressed && styles.controlPressed]}
                    >
                      <View style={[local.iconChoiceGlyph, selected && local.iconChoiceGlyphActive]}>
                        <MaterialCommunityIcons name={option.id as any} size={21} color={selected ? "#fff" : colors.primary} />
                      </View>
                      <Text style={[local.iconChoiceLabel, selected && local.iconChoiceLabelActive]} numberOfLines={1}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>}
              <Text style={local.fieldLabel}>Nazwa wydarzenia</Text>
              <TextInput accessibilityLabel="Nazwa wydarzenia" value={name} onChangeText={setName} maxLength={80} placeholder="np. Open'er Festival" placeholderTextColor={colors.muted} style={local.input} />
              <EventCityField value={city} countryCode={editingProposal?.details.countryCode ?? userCountryCode} extraCities={[userCity, ...availableEvents.filter((item) => (eventDetails[item.id]?.countryCode ?? "PL") === userCountryCode).map((item) => item.city)]} onChange={(value) => { setCity(value); setFormError(null); }} />
              <Text style={local.fieldLabel}>Miejsce (opcjonalnie)</Text>
              <TextInput accessibilityLabel="Miejsce wydarzenia" value={venue} onChangeText={setVenue} maxLength={120} placeholder="np. Tauron Arena, ul. Lema 7" placeholderTextColor={colors.muted} style={local.input} />
              <Text style={local.fieldLabel}>Opis (opcjonalnie)</Text>
              <TextInput accessibilityLabel="Opis wydarzenia" value={description} onChangeText={setDescription} maxLength={500} multiline placeholder="Kilka słów: kto gra, co się dzieje, dla kogo." placeholderTextColor={colors.muted} style={[local.input, local.textArea]} />
              <Text style={local.intro}>Godziny są podane w strefie czasowej Twojego telefonu. Zmiana początku przesuwa też koniec wydarzenia.</Text>
              <EventDateField label="Początek" value={startsAtInput} onChange={changeStart} allowPast={!!editingProposal} />
              <EventDateField label="Koniec" value={endsAtInput} onChange={(value) => { setEndsAtInput(value); setFormError(null); }} allowPast={!!editingProposal} />
              {formError && <Text accessibilityRole="alert" selectable style={{ color: colors.name === "light" ? "#b72543" : "#ff8fa4", fontSize: 14, lineHeight: 21 }}>{formError}</Text>}
              <Text style={local.intro}>Szkic zostaje zachowany po zamknięciu okna i zmianie zakładki, do czasu wylogowania lub zamknięcia aplikacji.</Text>
              <Pressable accessibilityRole="button" disabled={creating} onPress={() => void addCustomEvent()} style={({ pressed }) => [local.add, pressed && styles.controlPressed, creating && styles.primaryButtonDisabled]}>{creating ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="calendar-plus" size={19} color="#fff" />}<Text style={local.addText}>{editingProposal ? "Zatwierdź po zmianach" : canManage ? "Opublikuj wydarzenie" : "Wyślij zgłoszenie"}</Text></Pressable>
              </View>
            </View>
          )}
        </ScrollView>
        {view !== "add" && <View style={[local.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}><Pressable accessibilityRole="button" onPress={onClose} style={local.footerButton}><Text style={local.footerText}>Anuluj</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[local.footerButton, local.saveButton, saving && styles.primaryButtonDisabled]}>{saving ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="check" size={20} color="#fff" />}<Text style={[local.footerText, local.saveText]}>{draftEvents.length ? `Zapisz udział (${draftEvents.length})` : "Zapisz udział"}</Text></Pressable></View>}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const SPONSORED_CARD_EVERY = 8;

/** Ad shown as one card in the deck. Hidden until the ad has loaded; the
 *  person can move on after a moment, or turn ads off with Pro. */
function SponsoredDeckCard({ visible, onLoaded, onDone, onUpgrade }: { visible: boolean; onLoaded: () => void; onDone: () => void; onUpgrade: () => void }) {
  const { colors, styles } = useAppTheme();
  const [canSkip, setCanSkip] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setCanSkip(true), 1500);
    return () => clearTimeout(timer);
  }, [visible]);
  return (
    <View pointerEvents={visible ? "auto" : "none"} style={[styles.deckLayer, styles.sponsoredLayer, !visible && styles.sponsoredHidden]}>
      <GlassSurface style={styles.sponsoredCard}>
        <View style={styles.sponsoredHeader}>
          <Text style={styles.sponsoredEyebrow}>Reklama</Text>
          <Pressable accessibilityRole="button" onPress={onUpgrade} hitSlop={8}><Text style={styles.sponsoredUpgrade}>Bez reklam z Pro</Text></Pressable>
        </View>
        <View style={styles.sponsoredSlot}>
          <SparkAdBanner enabled placement="discover-card" size="card" onLoaded={onLoaded} onFailed={onDone} />
        </View>
        <Text style={styles.sponsoredText}>Dzięki reklamom Spark może być darmowy.</Text>
        <Pressable accessibilityRole="button" disabled={!canSkip} onPress={onDone} style={({ pressed }) => [styles.sponsoredNext, !canSkip && styles.primaryButtonDisabled, pressed && styles.controlPressed]}>
          <Text style={styles.sponsoredNextText}>Dalej</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={colors.onPrimary} />
        </Pressable>
      </GlassSurface>
    </View>
  );
}

function EventFriendsEmptyState({
  modeSwitch, screenMinHeight, activeEvents, loading, error, expiredCount, onBack, onManage
}: {
  modeSwitch: React.ReactNode;
  screenMinHeight: number;
  activeEvents: SparkEvent[];
  loading: boolean;
  error: string | null;
  expiredCount: number;
  onBack: () => void;
  onManage: () => void;
}) {
  const { colors, styles } = useAppTheme();
  const hasEvents = activeEvents.length > 0;
  return <View style={[styles.discoverScreen, styles.discoverEmptyScreen, { minHeight: screenMinHeight }]}>
    <DiscoverHeader left={{ icon: "chevron-left", label: "Wróć do osób", onPress: onBack }} actions={[{ icon: "calendar-edit", label: "Twoje wydarzenia", onPress: onManage }]} />
    {modeSwitch}
    <Pressable accessibilityRole="button" onPress={onManage} style={[styles.eventFriendsLaunch, styles.eventFriendsLaunchActive]}><View style={styles.eventFriendsLaunchIcon}><MaterialCommunityIcons name="calendar-heart" size={20} color="#fff" /></View><View style={styles.fill}><Text style={styles.eventFriendsLaunchEyebrow}>TWOJE WYDARZENIA</Text><Text style={styles.eventFriendsLaunchTitle}>{hasEvents ? `${activeEvents.length} aktywne` : "Wybierz pierwsze"}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color="#fff" /></Pressable>
    <View style={styles.discoverEmptyBody}>{loading ? <View style={styles.discoverEmptyIcon}><ActivityIndicator color={colors.primary} size="large" /></View> : <EventEmptyAnimation compact />}<Text style={styles.discoverEmptyTitle}>{loading ? "Szukamy wspólnych planów" : error ? "Nie udało się pobrać profili" : hasEvents ? "Jeszcze nikogo tu nie ma" : "Brak wybranych wydarzeń"}</Text><Text style={styles.discoverEmptyText}>{loading ? "Sprawdzamy osoby wybierające się na te same wydarzenia." : error ?? (hasEvents ? "Gdy ktoś wybierze jedno z tych samych wydarzeń, pojawi się tutaj jako karta do swipe." : "Wybierz jeden lub kilka eventów z oficjalnej listy Spark. Zobaczysz tylko osoby z przynajmniej jednym identycznym wyborem.")}</Text>{expiredCount > 0 && <View style={styles.discoverEmptyStat}><MaterialCommunityIcons name="clock-outline" size={18} color={colors.gold} /><Text style={styles.discoverEmptyStatText}>Usunięto {expiredCount} wygasłe wydarzenie{expiredCount === 1 ? "" : "a"}</Text></View>} {!loading && <><Pressable accessibilityRole="button" onPress={onManage} style={styles.primaryButton}><MaterialCommunityIcons name="calendar-search" size={19} color="#fff" /><Text style={styles.primaryButtonText}>{hasEvents ? "Zmień wydarzenia" : "Zobacz wydarzenia"}</Text></Pressable><Pressable accessibilityRole="button" onPress={onBack} style={styles.secondaryButtonWide}><Text style={styles.secondaryButtonText}>Wróć do zwykłego feedu</Text></Pressable></>}</View>
  </View>;
}

function DiscoverEmptyState({
  modeSwitch,
  screenMinHeight,
  activeEventCount,
  feedExpansionLevel,
  likedCount,
  loading,
  error,
  onRefresh,
  onOpenMatches,
  onOpenMessages,
  messageNotificationCount,
  onOpenProfile,
  onOpenPremium,
  onOpenSafety,
  onSignOut,
  onInvite,
  discoverFilters,
  onSavePreferences,
  onOpenEventFriends,
  onChromeHiddenChange
}: {
  screenMinHeight: number;
  activeEventCount: number;
  feedExpansionLevel: number;
  likedCount: number;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenMatches: () => void;
  onOpenMessages: () => void;
  messageNotificationCount: number;
  onOpenProfile: () => void;
  onOpenPremium: (source?: PremiumEntrySource) => void;
  onOpenSafety: () => void;
  onSignOut: () => void;
  onInvite: () => void;
  discoverFilters: DiscoverFilters;
  onSavePreferences: (nextFilters: DiscoverFilters) => Promise<boolean>;
  onOpenEventFriends: () => void;
  onChromeHiddenChange?: (hidden: boolean) => void;
  modeSwitch: React.ReactNode;
}) {
  const { colors, styles } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const overlayOpen = menuOpen || preferencesOpen;

  useEffect(() => {
    onChromeHiddenChange?.(overlayOpen);
    return () => onChromeHiddenChange?.(false);
  }, [onChromeHiddenChange, overlayOpen]);


  return (
    <View style={[styles.discoverScreen, styles.discoverEmptyScreen, { minHeight: screenMinHeight }]}>
      <DiscoverHeader left={{ icon: "menu", label: "Menu", onPress: () => setMenuOpen(true), dot: messageNotificationCount > 0 }} onFilters={() => setPreferencesOpen(true)} filtersActive={countActiveDiscoverFilters(discoverFilters) > 0} />
      {modeSwitch}
      <View style={styles.discoverEmptyBody}>
        <View style={styles.discoverEmptyIcon}>
          {loading ? <ActivityIndicator color={colors.primary} size="large" /> : <MaterialCommunityIcons name="cards-heart-outline" size={38} color={colors.primary} />}
        </View>
        <Text style={styles.discoverEmptyTitle} selectable>{loading ? "Szukamy profili" : error ? "Nie udało się pobrać profili" : "To wszystko na teraz"}</Text>
        <Text style={styles.discoverEmptyText} selectable>
          {loading ? "Dopasowujemy osoby do Twoich zainteresowań i preferencji." : error ? "Sprawdź połączenie i spróbuj odświeżyć listę." : feedExpansionLevel > 0 ? "Poszerzyliśmy zasięg, ale nie ma kolejnych profili. Zmień filtry, przywróć pominięte karty albo wróć później." : "Nie pokazujemy ponownie profili, które już oceniłeś. Wróć później albo przywróć pominięte karty."}
        </Text>
        {!loading && likedCount > 0 && (
          <View style={styles.discoverEmptyStat}>
            <MaterialCommunityIcons name="heart-outline" size={18} color={colors.primary} />
            <Text style={styles.discoverEmptyStatText} selectable>{likedCount} polubień czeka na wzajemność</Text>
          </View>
        )}
        {!loading && (
          <>
            <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.primaryButton}>
              <MaterialCommunityIcons name="refresh" size={19} color="#fff" />
              <Text style={styles.primaryButtonText}>{error ? "Spróbuj ponownie" : "Pokaż pominięte ponownie"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onOpenMatches} style={styles.secondaryButtonWide}>
              <Text style={styles.secondaryButtonText}>Przejdź do matchy</Text>
            </Pressable>
          </>
        )}
      </View>

      <DiscoveryMenuModal
        visible={menuOpen}
        filters={discoverFilters}
        onClose={() => setMenuOpen(false)}
        onOpenPreferences={() => setPreferencesOpen(true)}
        onRefresh={onRefresh}
        onOpenMatches={onOpenMatches}
        onOpenMessages={onOpenMessages}
        messageNotificationCount={messageNotificationCount}
        onOpenProfile={onOpenProfile}
        onOpenPremium={onOpenPremium}
        onOpenSafety={onOpenSafety}
        onSignOut={onSignOut}
        onInvite={onInvite}
      />

      <DiscoveryPreferencesModal
        visible={preferencesOpen}
        filters={discoverFilters}
        onClose={() => setPreferencesOpen(false)}
        onApply={onSavePreferences}
      />
    </View>
  );
}

function MatchCelebration({
  profile,
  viewerInterests,
  sparkLike,
  onContinue,
  onOpenChat
}: {
  profile: MatchProfile | null;
  viewerInterests: string[];
  sparkLike: boolean;
  onContinue: () => void;
  onOpenChat: (starter?: string) => void;
}) {
  const { colors, styles } = useAppTheme();
  const [selectedStarter, setSelectedStarter] = useState<string | null>(null);
  const starterAnimations = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const sparkPulse = useRef(new Animated.Value(0)).current;
  const starters = profile ? buildConversationStarters(profile, viewerInterests) : [];

  useEffect(() => {
    if (!profile) return;
    setSelectedStarter(null);
    starterAnimations.forEach((animation) => animation.setValue(0));
    sparkPulse.setValue(0);
    Animated.stagger(
      90,
      starterAnimations.map((animation) => Animated.spring(animation, {
        toValue: 1,
        damping: 15,
        stiffness: 170,
        useNativeDriver: true
      }))
    ).start();

    if (!sparkLike) return undefined;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(sparkPulse, { toValue: 1, duration: 720, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(sparkPulse, { toValue: 0, duration: 720, easing: Easing.in(Easing.quad), useNativeDriver: true })
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [profile, sparkLike, sparkPulse, starterAnimations]);

  if (!profile) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onContinue}>
      <View style={styles.matchCelebrationBackdrop}>
        <LinearGradient colors={sparkLike ? ["rgba(78,13,50,0.99)", "rgba(16,5,13,0.99)"] : ["rgba(44,7,28,0.98)", "rgba(5,5,7,0.99)"]} style={styles.matchCelebrationCard}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.matchCelebrationGlow,
              sparkLike && styles.sparkLikeCelebrationGlow,
              sparkLike && {
                opacity: sparkPulse.interpolate({ inputRange: [0, 1], outputRange: [0.46, 0.94] }),
                transform: [{ scale: sparkPulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.18] }) }]
              }
            ]}
          />
          <View style={[styles.matchCelebrationIcon, sparkLike && styles.sparkLikeCelebrationIcon]}>
            <MaterialCommunityIcons name={sparkLike ? "fire" : "heart-multiple"} size={34} color="#fff" />
          </View>
          <Text style={styles.matchCelebrationKicker} selectable>{sparkLike ? "SPARKLIKE • MATCH OD RAZU" : "WZAJEMNE POLUBIENIE"}</Text>
          <Text style={styles.matchCelebrationTitle} selectable>{sparkLike ? "Jest iskra!" : "To match!"}</Text>
          <Text style={styles.matchCelebrationText} selectable>
            {sparkLike ? "SPARKLIKE połączył Cię z " + profile.name + ". Rozmowa jest już odblokowana." : "Ty i " + profile.name + " polubiliście się. Rozmowa jest już odblokowana."}
          </Text>
          <Image source={profile.image} style={styles.matchCelebrationPhoto} contentFit="cover" />
          <View style={styles.matchStarterSection}>
            <View style={styles.matchStarterHeading}>
              <MaterialCommunityIcons name="creation" size={16} color={colors.primaryDeep} />
              <Text style={styles.matchStarterHeadingText}>Pierwsza iskra</Text>
            </View>
            {starters.map((starter, index) => (
              <Animated.View
                key={starter}
                style={{
                  opacity: starterAnimations[index],
                  transform: [{ translateY: starterAnimations[index].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }]
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedStarter === starter }}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSelectedStarter(starter);
                  }}
                  style={[styles.matchStarterOption, selectedStarter === starter && styles.matchStarterOptionActive]}
                >
                  <MaterialCommunityIcons name={selectedStarter === starter ? "check-circle" : "message-processing-outline"} size={17} color={selectedStarter === starter ? "#fff" : colors.primaryDeep} />
                  <Text style={[styles.matchStarterOptionText, selectedStarter === starter && styles.matchStarterOptionTextActive]} numberOfLines={2}>{starter}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={() => onOpenChat(selectedStarter ?? starters[0])} style={styles.matchCelebrationPrimary}>
            <MaterialCommunityIcons name="message-text" size={20} color="#fff" />
            <Text style={styles.matchCelebrationPrimaryText}>{selectedStarter ? "Użyj tej wiadomości" : "Zacznij rozmowę"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onContinue} style={styles.matchCelebrationSecondary}>
            <Text style={styles.matchCelebrationSecondaryText}>Odkrywaj dalej</Text>
          </Pressable>
        </LinearGradient>
      </View>
    </Modal>
  );
}

function MatchesScreen({
  profiles,
  matchedProfileKeys,
  likedProfileKeys,
  incomingLikeKinds,
  chatRequestKeys,
  chatThreads,
  hasPro,
  viewerInterests,
  viewerIntents,
  onLikeIncomingProfile,
  onCancelPendingLike,
  onSuperlikePendingProfile,
  onCancelRequest,
  onOpenMessages,
  onOpenConversation
}: {
  profiles: MatchProfile[];
  matchedProfileKeys: string[];
  likedProfileKeys: string[];
  incomingLikeKinds: Record<string, "like" | "superlike">;
  chatRequestKeys: string[];
  chatThreads: Record<string, ChatThread>;
  hasPro: boolean;
  viewerInterests: string[];
  viewerIntents: SparkIntent[];
  onLikeIncomingProfile: (profileKey: string) => Promise<void>;
  onCancelPendingLike: (profileKey: string) => Promise<void>;
  onSuperlikePendingProfile: (profileKey: string) => Promise<void>;
  onCancelRequest: (profileKey: string) => Promise<void>;
  onOpenMessages: () => void;
  onOpenConversation: (profileKey: string) => void;
}) {
  const { colors, styles } = useAppTheme();
  const [previewProfile, setPreviewProfile] = useState<MatchProfile | null>(null);
  const [modeFilter, setModeFilter] = useState<DeckMode | "all">("all");
  const modeOf = (profile: MatchProfile) => relationMode(chatThreads[getProfileKey(profile)], profile, viewerIntents);
  const relatedProfiles = profiles.filter((profile) => {
    const key = getProfileKey(profile);
    return matchedProfileKeys.includes(key) || likedProfileKeys.includes(key) || chatRequestKeys.includes(key) || (hasPro && Boolean(incomingLikeKinds[key]));
  });
  const modeCounts = countByMode(relatedProfiles.map(modeOf));
  const scopedProfiles = modeFilter === "all" ? profiles : profiles.filter((profile) => modeOf(profile) === modeFilter);
  const sortNewest = (items: MatchProfile[]) => [...items].sort((left, right) =>
    (chatThreads[getProfileKey(right)]?.createdAtMs ?? right.updatedAtMs ?? 0) - (chatThreads[getProfileKey(left)]?.createdAtMs ?? left.updatedAtMs ?? 0) || left.name.localeCompare(right.name, "pl")
  );
  const matchedProfiles = sortNewest(scopedProfiles.filter((profile) => matchedProfileKeys.includes(getProfileKey(profile))));
  const pendingLikes = sortNewest(scopedProfiles.filter((profile) => {
    const key = getProfileKey(profile);
    return likedProfileKeys.includes(key) && !matchedProfileKeys.includes(key);
  }));
  const incomingLikes = hasPro
    ? sortNewest(scopedProfiles.filter((profile) => {
        const key = getProfileKey(profile);
        return Boolean(incomingLikeKinds[key]) && !matchedProfileKeys.includes(key);
      }))
    : [];
  const pendingRequests = sortNewest(scopedProfiles.filter((profile) => {
    const key = getProfileKey(profile);
    return chatRequestKeys.includes(key) && !matchedProfileKeys.includes(key);
  }));
  const isEmpty = matchedProfiles.length === 0 && incomingLikes.length === 0 && pendingLikes.length === 0 && pendingRequests.length === 0;
  const modeColor = (profile: MatchProfile) => colors[modeOf(profile)];

  function confirmCancelLike(profile: MatchProfile) {
    Alert.alert("Cofnij polubienie", "Profil wróci do Odkrywaj i nie będzie już czekał na match.", [
      { text: "Anuluj", style: "cancel" },
      { text: "Cofnij", style: "destructive", onPress: () => void onCancelPendingLike(getProfileKey(profile)) }
    ]);
  }

  function confirmCancelRequest(profile: MatchProfile) {
    Alert.alert("Anuluj prośbę", "Usunąć oczekującą prośbę o chat?", [
      { text: "Nie", style: "cancel" },
      { text: "Anuluj prośbę", style: "destructive", onPress: () => void onCancelRequest(getProfileKey(profile)) }
    ]);
  }

  function renderRows(items: MatchProfile[], describe: (profile: MatchProfile) => string, trailing: (profile: MatchProfile) => React.ReactNode) {
    return (
      <View style={styles.mxGroup}>
        {items.map((profile, index) => (
          <React.Fragment key={getProfileKey(profile)}>
            {index > 0 && <View style={styles.mxDivider} />}
            <Pressable accessibilityRole="button" accessibilityLabel={"Otwórz profil " + profile.name} onPress={() => setPreviewProfile(profile)} style={({ pressed }) => [styles.mxRow, pressed && { backgroundColor: colors.fill }]}>
              <Image source={profile.image} style={styles.mxAvatar} contentFit="cover" />
              <View style={styles.fill}>
                <View style={styles.mxNameRow}>
                  <Text style={styles.mxName} numberOfLines={1}>{profile.name}, {profile.age}</Text>
                  <View style={[styles.mxDot, { backgroundColor: modeColor(profile) }]} />
                </View>
                <Text style={styles.mxSub} numberOfLines={1}>{describe(profile)}</Text>
              </View>
              {trailing(profile)}
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.gapLg}>
      <View style={styles.mxHeader}>
        <Text style={styles.mxTitle}>Matche</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Otwórz czat" onPress={onOpenMessages} hitSlop={8} style={styles.mxHeaderButton}>
          <MaterialCommunityIcons name="message-outline" size={21} color={colors.ink} />
        </Pressable>
      </View>

      {relatedProfiles.length > 0 && <ModeFilter value={modeFilter} onChange={setModeFilter} counts={modeCounts} />}

      {isEmpty && (
        <View style={styles.mxEmpty}>
          <MaterialCommunityIcons name="heart-outline" size={34} color={colors.muted} />
          <Text style={styles.mxEmptyTitle}>{relatedProfiles.length > 0 ? "Nic w tym trybie" : "Jeszcze bez matchy"}</Text>
          <Text style={styles.mxEmptyText}>{relatedProfiles.length > 0 ? "Wybierz inny tryb powyżej." : "Polub profil w Odkrywaj. Gdy druga osoba zrobi to samo, zobaczysz ją tutaj."}</Text>
        </View>
      )}

      {matchedProfiles.length > 0 && (
        <View style={styles.mxSection}>
          <Text style={styles.mxSectionTitle}>Nowe matche</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mxCarousel}>
            {matchedProfiles.map((profile) => (
              <Pressable
                key={getProfileKey(profile)}
                accessibilityRole="button"
                accessibilityLabel={"Napisz do " + profile.name}
                accessibilityHint="Przytrzymaj, aby zobaczyć profil"
                onPress={() => onOpenConversation(getProfileKey(profile))}
                onLongPress={() => setPreviewProfile(profile)}
                style={({ pressed }) => [styles.mxMatch, pressed && styles.controlPressed]}
              >
                <View style={[styles.mxMatchRing, { borderColor: modeColor(profile) }]}>
                  <Image source={profile.image} style={styles.mxMatchPhoto} contentFit="cover" />
                </View>
                <Text style={styles.mxMatchName} numberOfLines={1}>{profile.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {incomingLikes.length > 0 && (
        <View style={styles.mxSection}>
          <Text style={styles.mxSectionTitle}>Polubili Cię</Text>
          {renderRows(
            incomingLikes,
            (profile) => incomingLikeKinds[getProfileKey(profile)] === "superlike" ? "Wysłał(a) Ci SparkLike" : "Polubił(a) Twój profil",
            (profile) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={"Polub " + profile.name + " i utwórz match"}
                onPress={(event) => { event.stopPropagation(); void onLikeIncomingProfile(getProfileKey(profile)); }}
                hitSlop={6}
                style={styles.mxLikeBack}
              >
                <MaterialCommunityIcons name="heart" size={18} color={colors.onPrimary} />
              </Pressable>
            )
          )}
        </View>
      )}

      {pendingLikes.length > 0 && (
        <View style={styles.mxSection}>
          <Text style={styles.mxSectionTitle}>Polubione przez Ciebie</Text>
          {renderRows(
            pendingLikes,
            () => "Czeka na wzajemność",
            (profile) => (
              <Pressable accessibilityRole="button" accessibilityLabel={"Cofnij polubienie profilu " + profile.name} onPress={(event) => { event.stopPropagation(); confirmCancelLike(profile); }} hitSlop={10} style={styles.mxQuiet}>
                <MaterialCommunityIcons name="close" size={18} color={colors.muted} />
              </Pressable>
            )
          )}
          <Text style={styles.mxCaption}>Otwórz profil, aby wysłać SparkLike i od razu utworzyć match.</Text>
        </View>
      )}

      {pendingRequests.length > 0 && (
        <View style={styles.mxSection}>
          <Text style={styles.mxSectionTitle}>Prośby o chat</Text>
          {renderRows(
            pendingRequests,
            (profile) => chatThreads[getProfileKey(profile)]?.requestDirection === "incoming" ? "Czeka na Twoją decyzję w Czacie" : "Wysłana, czeka na akceptację",
            (profile) => chatThreads[getProfileKey(profile)]?.requestDirection === "incoming"
              ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
              : (
                <Pressable accessibilityRole="button" accessibilityLabel={"Anuluj prośbę do " + profile.name} onPress={(event) => { event.stopPropagation(); confirmCancelRequest(profile); }} hitSlop={10} style={styles.mxQuiet}>
                  <MaterialCommunityIcons name="close" size={18} color={colors.muted} />
                </Pressable>
              )
          )}
        </View>
      )}
      {previewProfile && (
        <ProfilePreviewSheet
          profile={previewProfile}
          viewerInterests={viewerInterests}
          onClose={() => setPreviewProfile(null)}
          canViewSocials={matchedProfileKeys.includes(getProfileKey(previewProfile))}
          relationshipStatus={matchedProfileKeys.includes(getProfileKey(previewProfile)) ? "matched" : chatRequestKeys.includes(getProfileKey(previewProfile)) ? "requested" : likedProfileKeys.includes(getProfileKey(previewProfile)) ? "liked" : "none"}
          onMessage={matchedProfileKeys.includes(getProfileKey(previewProfile)) ? () => { const key = getProfileKey(previewProfile); setPreviewProfile(null); onOpenConversation(key); } : undefined}
          onLike={() => { const key = getProfileKey(previewProfile); if (incomingLikeKinds[key]) void onLikeIncomingProfile(key); }}
          onSuperlike={() => { void onSuperlikePendingProfile(getProfileKey(previewProfile)); }}
        />
      )}
    </View>
  );
}
function MessagesScreen({
  profiles,
  matchedProfileKeys,
  chatRequestKeys,
  chatThreads,
  selectedChatKey,
  setSelectedChatKey,
  pendingMessageDraft,
  onPendingMessageDraftConsumed,
  onSendMessage,
  onAcceptRequest,
  onRejectRequest,
  onBlockProfile,
  onReportProfile,
  viewerInterests,
  viewerIntents,
  showChatListAd
}: {
  profiles: MatchProfile[];
  matchedProfileKeys: string[];
  chatRequestKeys: string[];
  chatThreads: Record<string, ChatThread>;
  selectedChatKey: string | null;
  setSelectedChatKey: (value: string | null) => void;
  pendingMessageDraft: { profileKey: string; text: string } | null;
  onPendingMessageDraftConsumed: () => void;
  onSendMessage: (profileKey: string, text: string) => Promise<boolean>;
  onAcceptRequest: (profileKey: string) => void;
  onRejectRequest: (profileKey: string) => void;
  onBlockProfile: (profileKey: string) => void;
  onReportProfile: (profileKey: string) => void;
  viewerInterests: string[];
  viewerIntents: SparkIntent[];
  showChatListAd: boolean;
}) {
  const { colors, styles } = useAppTheme();
  const [messageView, setMessageView] = useState<"chats" | "requests">("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<DeckMode | "all">("all");
  const [profilePreview, setProfilePreview] = useState<MatchProfile | null>(null);
  const [profileReturnChatKey, setProfileReturnChatKey] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState(
    pendingMessageDraft?.profileKey === selectedChatKey ? pendingMessageDraft.text : ""
  );

  useEffect(() => {
    setMessageDraft(pendingMessageDraft?.profileKey === selectedChatKey ? pendingMessageDraft.text : "");
    if (pendingMessageDraft?.profileKey === selectedChatKey) onPendingMessageDraftConsumed();
  }, [selectedChatKey]);

  const conversations = useMemo(() => profiles
    .filter((profile) => {
      const key = getProfileKey(profile);
      return matchedProfileKeys.includes(key) || chatRequestKeys.includes(key) || Boolean(chatThreads[key]);
    })
    .map((profile) => {
      const key = getProfileKey(profile);
      const thread = chatThreads[key];
      const isMatched = matchedProfileKeys.includes(key) || thread?.status === "matched";
      const isBlocked = thread?.status === "blocked";
      const latestMessage = thread?.messages[thread.messages.length - 1];
      const latestMessageText = latestMessage?.text ?? thread?.lastMessageText;
      const latestMessageTime = latestMessage?.time ?? (thread?.lastMessageAtMs ? formatTime(thread.lastMessageAtMs) : undefined);
      const unreadCount = Math.max(0, thread?.unreadCount ?? 0);

      return {
        key,
        profile,
        name: profile.surname ? profile.name + " " + profile.surname[0] + "." : profile.name,
        message: isBlocked
          ? "Profil zablokowany."
          : latestMessageText ?? (isMatched ? "Match aktywny - mo\u017cecie pisa\u0107." : thread?.introMessage ?? "Pro\u015bba o chat czeka na akceptacj\u0119."),
        time: latestMessageTime ?? (isMatched ? "aktywny" : "oczekuje"),
        unreadCount,
        mode: relationMode(thread, profile, viewerIntents),
        eventTitle: thread?.eventContext?.name,
        status: (isBlocked ? "blocked" : isMatched ? "matched" : "requested") as ChatStatus
      };
    }), [chatRequestKeys, chatThreads, matchedProfileKeys, profiles, viewerIntents]);
  const requestConversations = conversations.filter((conversation) => conversation.status === "requested");
  const chatConversations = conversations.filter((conversation) => conversation.status !== "requested");
  const unreadChatsCount = chatConversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const sourceConversations = messageView === "chats" ? chatConversations : requestConversations;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const modeCounts = countByMode(sourceConversations.map((conversation) => conversation.mode));
  const visibleConversations = sourceConversations.filter((conversation) => (modeFilter === "all" || conversation.mode === modeFilter)) .filter((conversation) =>
    !normalizedQuery || conversation.name.toLowerCase().includes(normalizedQuery) || conversation.message.toLowerCase().includes(normalizedQuery)
  );
  const selectedConversation = conversations.find((conversation) => conversation.key === selectedChatKey) ?? null;
  const emptyTitle = normalizedQuery ? "Brak wyników" : messageView === "chats" ? "Brak aktywnych chatów" : "Brak nowych próśb";
  const emptyText = normalizedQuery
    ? "Spróbuj wpisać inne imię lub fragment wiadomości."
    : messageView === "chats"
      ? "Chat pojawi się tutaj po wzajemnym matchu."
      : "Prośby o rozmowę czekają tutaj osobno do czasu akceptacji.";

  function selectMessageView(nextView: "chats" | "requests") {
    setMessageView(nextView);
    setSelectedChatKey(null);
  }

  function openConversationProfile() {
    if (!selectedConversation) return;
    const profile = selectedConversation.profile;
    setProfileReturnChatKey(selectedConversation.key);
    setSelectedChatKey(null);
    setTimeout(() => setProfilePreview(profile), 0);
  }

  function closeConversationProfile(returnToChat = true) {
    const returnKey = profileReturnChatKey;
    setProfilePreview(null);
    setProfileReturnChatKey(null);
    if (returnToChat && returnKey) {
      setTimeout(() => setSelectedChatKey(returnKey), 40);
    }
  }
  const presentModes = (["romantic", "friends", "event"] as const).filter((mode) => modeCounts[mode] > 0).length;

  return (
    <View style={styles.gapLg}>
      <View style={styles.mxHeader}>
        <Text style={styles.mxTitle}>Czat</Text>
      </View>
      <View style={styles.cxSegment} accessibilityRole="tablist">
        {([["chats", "Rozmowy", unreadChatsCount], ["requests", "Prośby", requestConversations.length]] as const).map(([view, label, count]) => {
          const active = messageView === view;
          return (
            <Pressable key={view} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label + (count > 0 ? ", " + count : "")} onPress={() => selectMessageView(view)} style={[styles.cxSegmentItem, active && styles.cxSegmentItemActive]}>
              <Text style={[styles.cxSegmentText, active && styles.cxSegmentTextActive]}>{label}</Text>
              {count > 0 && <View style={styles.cxSegmentBadge}><Text style={styles.cxSegmentBadgeText}>{formatBadgeCount(count)}</Text></View>}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.cxSearch}>
        <MaterialCommunityIcons name="magnify" size={19} color={colors.muted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          placeholder="Szukaj"
          placeholderTextColor={colors.muted}
          style={styles.cxSearchInput}
        />
        {searchQuery.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Wyczyść wyszukiwanie" onPress={() => setSearchQuery("")} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {presentModes > 1 && <ModeFilter value={modeFilter} onChange={setModeFilter} counts={modeCounts} />}
      {visibleConversations.length === 0 ? (
        <View style={styles.mxEmpty}>
          <MaterialCommunityIcons name="message-outline" size={34} color={colors.muted} />
          <Text style={styles.mxEmptyTitle}>{emptyTitle}</Text>
          <Text style={styles.mxEmptyText}>{emptyText}</Text>
        </View>
      ) : (
        <>
          <View style={styles.mxGroup}>
            {visibleConversations.map((conversation, index) => {
              const unread = conversation.unreadCount > 0;
              return (
                <React.Fragment key={conversation.key}>
                  {index > 0 && <View style={styles.cxDivider} />}
                  <Pressable accessibilityRole="button" accessibilityLabel={"Otwórz rozmowę z " + conversation.name + (unread ? ". Nieprzeczytane: " + conversation.unreadCount : "")} onPress={() => setSelectedChatKey(conversation.key)} style={({ pressed }) => [styles.cxRow, pressed && { backgroundColor: colors.fill }]}>
                    <Image source={conversation.profile.image} style={styles.cxAvatar} contentFit="cover" />
                    <View style={styles.fill}>
                      <View style={styles.cxTopLine}>
                        <View style={[styles.mxNameRow, styles.fill]}>
                          <Text style={[styles.mxName, unread && styles.cxNameUnread]} numberOfLines={1}>{conversation.name}</Text>
                          <View style={[styles.mxDot, { backgroundColor: colors[conversation.mode] }]} />
                        </View>
                        <Text style={[styles.cxTime, unread && styles.cxTimeUnread]}>{conversation.time}</Text>
                      </View>
                      <View style={styles.cxBottomLine}>
                        <Text style={[styles.cxMessage, unread && styles.cxMessageUnread]} numberOfLines={2}>{conversation.message}</Text>
                        {unread && <View style={styles.cxUnread}><Text style={styles.cxUnreadText}>{formatBadgeCount(conversation.unreadCount)}</Text></View>}
                      </View>
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>
          {showChatListAd && messageView === "chats" && !normalizedQuery && visibleConversations.length >= 2 && (
            <SparkAdBanner enabled placement="messages-list" tone={colors.name === "dark" ? "dark" : "light"} />
          )}
        </>
      )}

      <ChatConversationModal
        conversation={selectedConversation}
        thread={selectedConversation ? chatThreads[selectedConversation.key] : undefined}
        draft={messageDraft}
        setDraft={setMessageDraft}
        onClose={() => { setMessageDraft(""); setSelectedChatKey(null); }}
        onSend={onSendMessage}
        onAccept={onAcceptRequest}
        onReject={onRejectRequest}
        onBlock={onBlockProfile}
        onReport={onReportProfile}
        onOpenProfile={openConversationProfile}
        viewerInterests={viewerInterests}
      />
      {profilePreview && (
        <ProfilePreviewSheet
          profile={profilePreview}
          viewerInterests={viewerInterests}
          onClose={() => closeConversationProfile(true)}
          canViewSocials={matchedProfileKeys.includes(getProfileKey(profilePreview))}
          relationshipStatus={matchedProfileKeys.includes(getProfileKey(profilePreview)) ? "matched" : chatRequestKeys.includes(getProfileKey(profilePreview)) ? "requested" : "none"}
          onMessage={() => closeConversationProfile(true)}
        />
      )}
    </View>
  );
}

function ChatConversationModal({
  conversation,
  thread,
  draft,
  setDraft,
  onClose,
  onSend,
  onAccept,
  onReject,
  onBlock,
  onReport,
  onOpenProfile,
  viewerInterests
}: {
  conversation: { key: string; profile: MatchProfile; name: string; status: ChatStatus } | null;
  thread?: ChatThread;
  draft: string;
  setDraft: (value: string) => void;
  onClose: () => void;
  onSend: (profileKey: string, text: string) => Promise<boolean>;
  onAccept: (profileKey: string) => void;
  onReject: (profileKey: string) => void;
  onBlock: (profileKey: string) => void;
  onReport: (profileKey: string, reason?: string) => void;
  onOpenProfile: () => void;
  viewerInterests: string[];
}) {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const messages = thread?.messages ?? [];
  const [sending, setSending] = useState(false);
  const messageListRef = useRef<FlatList<ChatThread["messages"][number]>>(null);
  const canMessage = conversation?.status === "matched";
  const local = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.fillStronger },
    iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    identityButton: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.photoPlaceholder },
    name: { color: colors.ink, fontSize: 16, fontWeight: "600" },
    status: { marginTop: 1, color: colors.muted, fontSize: 12 },
    eventLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
    eventLineText: { flexShrink: 1, color: colors.muted, fontSize: 12, fontWeight: "500" },
    messages: { flexGrow: 1, justifyContent: messages.length === 0 ? "center" : "flex-end", gap: 6, paddingHorizontal: 12, paddingVertical: 16 },
    empty: { alignItems: "center", gap: 8, padding: 24 },
    emptyTitle: { marginTop: 4, color: colors.ink, fontSize: 18, fontWeight: "700", textAlign: "center" },
    emptyText: { maxWidth: 300, color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
    starterLead: { marginTop: 14, alignSelf: "flex-start", color: colors.muted, fontSize: 13, fontWeight: "600" },
    starterList: { width: "100%", gap: 8, marginTop: 2 },
    starterChip: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: colors.fill },
    starterChipText: { color: colors.ink, fontSize: 14, lineHeight: 19 },
    messageRow: { width: "100%", flexDirection: "row", alignItems: "flex-end", gap: 6 },
    messageRowMine: { justifyContent: "flex-end" },
    messageAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.photoPlaceholder },
    messageAvatarSpacer: { width: 26, height: 26 },
    bubble: { maxWidth: "76%", paddingHorizontal: 13, paddingTop: 8, paddingBottom: 6, borderRadius: 19 },
    bubbleMe: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 5 },
    bubbleThem: { alignSelf: "flex-start", backgroundColor: colors.surfaceStrong, borderBottomLeftRadius: 5 },
    bubbleText: { color: colors.ink, fontSize: 16, lineHeight: 21 },
    bubbleTextMe: { color: colors.onPrimary },
    bubbleTime: { marginTop: 2, color: colors.muted, fontSize: 10, textAlign: "right", fontVariant: ["tabular-nums"] },
    bubbleTimeMe: { color: "rgba(255,255,255,0.72)" },
    pending: { margin: 12, gap: 6, padding: 16, borderRadius: 18, backgroundColor: colors.surfaceStrong },
    pendingTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
    pendingText: { color: colors.muted, fontSize: 14, lineHeight: 19 },
    pendingActions: { flexDirection: "row", gap: 10, marginTop: 8 },
    acceptButton: { flex: 1, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: colors.primary },
    rejectButton: { flex: 1, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: colors.fill },
    acceptText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" },
    rejectText: { color: colors.ink, fontSize: 16, fontWeight: "600" },
    composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.fillStronger, backgroundColor: colors.background },
    input: { flex: 1, minHeight: 40, maxHeight: 120, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, borderRadius: 20, color: colors.ink, backgroundColor: colors.fill, fontSize: 16 },
    send: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    sendDisabled: { opacity: 0.35 }
  }), [colors, messages.length === 0]);

  if (!conversation) {
    return null;
  }

  const activeConversation = conversation;
  const conversationProfile = thread?.eventContext
    ? { ...activeConversation.profile, sharedEvents: [thread.eventContext] }
    : activeConversation.profile;
  const conversationStarters = buildConversationStarters(conversationProfile, viewerInterests);

  function confirmBlock() {
    Alert.alert("Zablokuj profil", `Czy na pewno chcesz zablokowa\u0107 ${activeConversation.name}?`, [
      { text: "Anuluj", style: "cancel" },
      { text: "Zablokuj", style: "destructive", onPress: () => { onBlock(activeConversation.key); onClose(); } }
    ]);
  }

  function confirmReport() {
    Alert.alert("Pow\u00f3d zg\u0142oszenia", `Co jest nie tak z profilem ${activeConversation.name}?`, [
      { text: "Spam", onPress: () => onReport(activeConversation.key, "Spam lub reklamy") },
      { text: "N\u0119kanie", onPress: () => onReport(activeConversation.key, "N\u0119kanie lub obra\u017aliwe wiadomo\u015bci") },
      { text: "Fa\u0142szywy profil", onPress: () => onReport(activeConversation.key, "Fa\u0142szywy profil") },
      { text: "Anuluj", style: "cancel" }
    ]);
  }

  async function send() {
    if (!draft.trim() || !canMessage || sending) return;
    const outgoingMessage = draft;
    setDraft("");
    setSending(true);
    try {
      const sent = await onSend(activeConversation.key, outgoingMessage);
      if (!sent) setDraft(outgoingMessage);
    } finally {
      setSending(false);
    }
  }

  function openSafetyMenu() {
    Alert.alert("Rozmowa", "Wybierz dzia\u0142anie dotycz\u0105ce tego profilu.", [
      { text: "Zg\u0142o\u015b", onPress: confirmReport },
      { text: "Zablokuj", style: "destructive", onPress: confirmBlock },
      { text: "Anuluj", style: "cancel" }
    ]);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={local.root}>
        <StatusBar style={colors.statusBar} />
        <View style={[local.header, { paddingTop: Math.max(insets.top, 10) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Wróć" onPress={onClose} hitSlop={6} style={local.iconButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Otwórz profil ${activeConversation.name}`} onPress={onOpenProfile} style={local.identityButton}>
            <Image source={activeConversation.profile.image} style={local.avatar} contentFit="cover" />
            <View style={styles.fill}>
              <Text style={local.name} numberOfLines={1}>{activeConversation.name}</Text>
              <Text style={local.status} numberOfLines={1}>{canMessage ? "Zobacz profil" : activeConversation.status === "blocked" ? "Profil zablokowany" : "Oczekuje na akceptację"}</Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Opcje rozmowy" onPress={openSafetyMenu} hitSlop={6} style={local.iconButton}>
            <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={24} color={colors.primary} />
          </Pressable>
        </View>
        {thread?.eventContext && (
          <View style={local.eventLine}>
            <MaterialCommunityIcons name={thread.eventContext.icon as any} size={14} color={colors.muted} />
            <Text style={local.eventLineText} numberOfLines={1}>{thread.eventContext.name} · {formatEventDateRange(thread.eventContext)}</Text>
          </View>
        )}

        <FlatList
          ref={messageListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item: message, index }) => {
            const isMine = message.from === "me";
            const nextMessage = messages[index + 1];
            const showAvatar = !isMine && (!nextMessage || nextMessage.from === "me");
            return (
              <View style={[local.messageRow, isMine && local.messageRowMine]}>
                {!isMine && (showAvatar
                  ? <Image source={activeConversation.profile.image} style={local.messageAvatar} contentFit="cover" />
                  : <View style={local.messageAvatarSpacer} />)}
                <View style={[local.bubble, isMine ? local.bubbleMe : local.bubbleThem]}>
                  <Text style={[local.bubbleText, isMine && local.bubbleTextMe]} selectable noTranslate>{message.text}</Text>
                  <Text style={[local.bubbleTime, isMine && local.bubbleTimeMe]}>{message.time}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={local.empty}>
              <Image source={activeConversation.profile.image} style={{ width: 72, height: 72, borderRadius: 36 }} contentFit="cover" />
              <Text style={local.emptyTitle}>{canMessage ? "Zacznij rozmowę" : "Prośba oczekuje"}</Text>
              <Text style={local.emptyText}>{canMessage ? "Napisz o czymś, co naprawdę Was łączy." : "Wiadomości odblokują się po zaakceptowaniu prośby."}</Text>
              {canMessage && (
                <>
                  <Text style={local.starterLead}>Na dobry początek</Text>
                  <View style={local.starterList}>
                    {conversationStarters.map((starter) => (
                      <Pressable key={starter} accessibilityRole="button" accessibilityHint="Wstawia tekst do pola wiadomości" onPress={() => { void Haptics.selectionAsync(); setDraft(starter); }} style={({ pressed }) => [local.starterChip, pressed && styles.controlPressed]}>
                        <Text style={local.starterChipText} numberOfLines={3}>{starter}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          }
          contentContainerStyle={local.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={18}
          maxToRenderPerBatch={18}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          onContentSizeChange={() => messages.length > 0 && messageListRef.current?.scrollToEnd({ animated: false })}
        />

        {!canMessage ? (
          <View style={[local.pending, { marginBottom: Math.max(insets.bottom, 12) }]}>
            <Text style={local.pendingTitle}>{thread?.requestDirection === "incoming" ? "Chce z Tobą porozmawiać" : "Czekamy na odpowiedź"}</Text>
            <Text style={local.pendingText}>{thread?.requestDirection === "incoming" ? "Zaakceptuj prośbę, żeby zacząć pisać." : "Druga osoba musi zaakceptować prośbę albo odwzajemnić polubienie."}</Text>
            {thread?.requestDirection === "incoming" && (
              <View style={local.pendingActions}>
                <Pressable accessibilityRole="button" onPress={() => onReject(activeConversation.key)} style={({ pressed }) => [local.rejectButton, pressed && styles.controlPressed]}><Text style={local.rejectText}>Odrzuć</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => onAccept(activeConversation.key)} style={({ pressed }) => [local.acceptButton, pressed && styles.controlPressed]}><Text style={local.acceptText}>Akceptuj</Text></Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={[local.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              autoCorrect
              maxLength={2000}
              placeholder="Wiadomość"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Treść wiadomości"
              editable={!sending}
              style={local.input}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Wyślij" disabled={!draft.trim() || sending} onPress={() => { void send(); }} style={[local.send, (!draft.trim() || sending) && local.sendDisabled]}>
              {sending ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <MaterialCommunityIcons name="arrow-up" size={22} color={colors.onPrimary} />}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
function PremiumScreen({
  premiumPlan,
  setPremiumPlan,
  revenueCat,
  entrySource
}: {
  premiumPlan: SparkPlanId;
  setPremiumPlan: (value: SparkPlanId) => void;
  revenueCat: RevenueCatState;
  entrySource: PremiumEntrySource;
}) {
  const { colors, styles } = useAppTheme();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const premiumMessages: Record<PremiumEntrySource, { badge: string; title: string; body: string }> = {
    navigation: { badge: "Spark Pro", title: "Więcej możliwości, mniej ograniczeń", body: "Zwiększ widoczność, odkrywaj zainteresowane osoby i korzystaj ze Spark bez reklam." },
    spark_like: { badge: "SparkLike", title: "Wyróżnij profil, który naprawdę Cię interesuje", body: "SparkLike zwiększa szansę, że druga osoba zauważy Cię od razu." },
    chat_request: { badge: "Rozmowa Pro", title: "Napisz przed matchem", body: "Wyślij krótką prośbę o chat i zacznij rozmowę bez czekania na wzajemne polubienie." },
    profile_views: { badge: "Odwiedziny", title: "Zobacz, kto ogląda Twój profil", body: "Przeglądaj pełną listę odwiedzin, filtruj ją i wracaj do interesujących osób." },
    photos: { badge: "Więcej zdjęć", title: "Pokaż więcej siebie", body: "Dodaj do 15 zdjęć i zbuduj profil, który łatwiej rozpoczyna rozmowę." }
  };
  const premiumMessage = premiumMessages[entrySource];

  useEffect(() => {
    if (!revenueCat.isPro) {
      void revenueCat.trackPaywallView(entrySource);
    }
  }, [entrySource, revenueCat.isPro, revenueCat.trackPaywallView]);
  const selectedPlan = premiumPlans.find((plan) => plan.id === premiumPlan) ?? premiumPlans[1];
  const hasPackages = revenueCat.packages.length > 0;
  const getPlanPrice = (planId: SparkPlanId, fallback: string) => revenueCat.prices[planId] ?? (revenueCat.configured ? "-" : fallback);
  const selectedPlanPrice = getPlanPrice(premiumPlan, selectedPlan.price);
  const primaryDisabled = busyAction !== null || revenueCat.isLoading || revenueCat.isPro || !hasPackages;
  const planCards: Record<SparkPlanId, { label: string; period: string; helper: string; badge?: string }> = {
    weekly: { label: "Tydzień", period: "/ 7 dni", helper: "Na próbę" },
    monthly: { label: "Miesiąc", period: "/ mies.", helper: "Najlepszy wybór", badge: "Popularny" },
    lifetime: { label: "Na zawsze", period: "jednorazowo", helper: "Zakup jednorazowy" }
  };
  const benefitRows = [
    ["advertisements-off", "Zero reklam", "Przeglądanie profili bez przerw i bez bannerów."],
    ["eye-check", "Zobacz, kto Cię polubił", "Odkrywaj osoby, które już dały Ci swipe."],
    ["account-eye", "Kto oglądał Twój profil", "Prywatna lista osób, które otworzyły szczegóły Twojej karty."],
    ["message-badge", "Prośba o chat", "Napisz do profilu przed matchem i czekaj na akceptację."],
    ["crown", "Korona Pro", "Widoczny status premium przy Twoim profilu."],
    ["image-multiple", "Do 15 zdjęć", "Więcej miejsca na zdjęcia i lepszy podgląd profilu."],
    ["rocket-launch", "Boost widoczności", "Częstsze pojawianie się u innych w odkrywaniu."],
    ["fire", "10 SparkLike miesięcznie", "Więcej wyróżnień dla profili, które naprawdę Cię interesują."]
  ];
  const local = StyleSheet.create({
    screen: { gap: 16 },
    top: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    iconButton: { width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
    topTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
    hero: { alignItems: "center", gap: 8, paddingTop: 8, paddingHorizontal: 8 },
    heroBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: "hidden", color: colors.primary, backgroundColor: "rgba(255,45,141,0.12)", borderWidth: 1, borderColor: "rgba(255,45,141,0.22)", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
    heroTitle: { color: colors.ink, fontSize: 26, lineHeight: 32, textAlign: "center", fontWeight: "900" },
    heroText: { maxWidth: 360, color: "#e4bdc3", fontSize: 13, lineHeight: 20, textAlign: "center", fontWeight: "700" },
    tierGrid: { flexDirection: "row", gap: 8, alignItems: "stretch" },
    tierCard: { flex: 1, minHeight: 136, gap: 6, paddingHorizontal: 8, paddingTop: 14, paddingBottom: 10, alignItems: "center", justifyContent: "center", borderRadius: 22, borderCurve: "continuous", backgroundColor: colors.card, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", overflow: "hidden" },
    tierActive: { borderColor: "rgba(255,45,141,0.9)", backgroundColor: colors.card, boxShadow: "0 12px 28px rgba(255,45,141,0.16)" },
    bestRibbon: { minHeight: 18, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.primary },
    bestText: { color: "#fff", fontSize: 8, lineHeight: 11, fontWeight: "900", textTransform: "uppercase" },
    tierLabel: { color: colors.ink, fontSize: 13, lineHeight: 17, fontWeight: "900", textAlign: "center" },
    tierLabelActive: { color: "#fff" },
    tierPrice: { color: colors.ink, fontSize: 19, lineHeight: 24, textAlign: "center", fontWeight: "900" },
    tierPeriod: { color: colors.muted, fontSize: 10, lineHeight: 13, textAlign: "center", fontWeight: "800" },
    tierAccent: { color: "#f5a7c8", fontSize: 10, lineHeight: 13, textAlign: "center", fontWeight: "900" },
    selectedPill: { minHeight: 24, paddingHorizontal: 9, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
    selectedPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    selectedPillText: { color: colors.muted, fontSize: 9, lineHeight: 12, fontWeight: "900", textTransform: "uppercase" },
    selectedPillTextActive: { color: "#fff" },
    benefitsPanel: { gap: 14, padding: 16, borderRadius: 30, borderCurve: "continuous", backgroundColor: colors.card, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    sectionTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
    benefitRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    benefitIcon: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,45,141,0.14)" },
    benefitTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
    benefitText: { marginTop: 2, color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" },
    primaryCta: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, backgroundColor: colors.primary, boxShadow: "0 18px 38px rgba(255,45,141,0.28)" },
    primaryCtaDisabled: { opacity: 0.48 },
    primaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
    statusBox: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, backgroundColor: "rgba(255,45,141,0.1)", borderWidth: 1, borderColor: "rgba(255,45,141,0.2)" },
    statusCopy: { flex: 1, gap: 7 },
    statusText: { color: colors.primaryDeep, fontSize: 12, lineHeight: 18, fontWeight: "800" },
    retryButton: { alignSelf: "flex-start", minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,45,141,0.18)", borderWidth: 1, borderColor: "rgba(255,45,141,0.28)" },
    retryText: { color: colors.primary, fontSize: 11, fontWeight: "900" },
    footerActions: { alignItems: "center", gap: 12, paddingTop: 2, paddingBottom: 6 },
    restoreButton: { minHeight: 44, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
    restoreText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
    legalRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18 },
    legalText: { color: colors.muted, fontSize: 11, fontWeight: "800", textDecorationLine: "underline" },
    billingText: { paddingHorizontal: 10, color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center", fontWeight: "700" }
  });

  async function activateSelectedPlan() {
    setBusyAction("purchase");
    try {
      if (!hasPackages) {
        const activated = false;
        if (!activated && revenueCat.error) {
          Alert.alert("Spark Pro", "Nie udało się otworzyć pakietów. Spróbuj ponownie później.");
        }
        return;
      }

      trackSparkEvent("pro_purchase_started", { plan: selectedPlan.id });
      const result = await revenueCat.purchasePlan(selectedPlan.id);
      if (result.ok) {
        trackSparkEvent("pro_purchase_completed", { plan: selectedPlan.id });
        Alert.alert("Spark Pro", "Dostęp premium jest aktywny.");
      } else if (!result.cancelled) {
        trackSparkEvent("pro_purchase_failed", { plan: selectedPlan.id });
        Alert.alert("Zakup nieudany", result.message);
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function retryOfferings() {
    setBusyAction("offerings");
    const available = await revenueCat.refreshOfferings();
    setBusyAction(null);

    if (!available) {
      Alert.alert("Spark Pro", "Pakiety nadal nie są dostępne. Sprawdź połączenie i spróbuj ponownie.");
    }
  }

  async function restorePro() {
    setBusyAction("restore");
    const result = await revenueCat.restorePurchases();
    setBusyAction(null);
    if (result.ok && hasSparknewPro(result.customerInfo ?? null)) {
      Alert.alert("Zakupy przywrócone", "Spark Pro jest ponownie aktywny.");
    } else if (result.ok) {
      Alert.alert("Brak aktywnego zakupu", "Nie znaleziono aktywnego Spark Pro dla tego konta sklepu.");
    } else {
      Alert.alert("Przywracanie nieudane", result.message);
    }
  }


  return (
    <View style={local.screen}>
      <TopBar eyebrow={revenueCat.isPro ? "Aktywne" : "Premium"} title="Spark Pro" left="pro" right={revenueCat.isPro ? "on" : "off"} />

      <View style={local.hero}>
        <Text style={local.heroBadge} selectable>{revenueCat.isPro ? "Aktywne" : premiumMessage.badge}</Text>
        <Text style={local.heroTitle} selectable>{revenueCat.isPro ? "Spark Pro jest aktywny" : premiumMessage.title}</Text>
        <Text style={local.heroText} selectable>{revenueCat.isPro ? "Wszystkie funkcje premium są dostępne na tym koncie." : premiumMessage.body}</Text>
      </View>

      <View style={local.tierGrid}>
        {premiumPlans.map((plan) => {
          const active = premiumPlan === plan.id;
          const card = planCards[plan.id];

          return (
            <Pressable key={plan.id} onPress={() => setPremiumPlan(plan.id)} style={[local.tierCard, active && local.tierActive]}>
              {card.badge ? <View style={local.bestRibbon}><Text style={local.bestText} numberOfLines={1}>{card.badge}</Text></View> : <View style={{ minHeight: 18 }} />}
              <Text style={[local.tierLabel, active && local.tierLabelActive]} numberOfLines={1} selectable>{card.label}</Text>
              <Text style={local.tierPrice} numberOfLines={1} selectable>{getPlanPrice(plan.id, plan.price)}</Text>
              <Text style={local.tierPeriod} numberOfLines={1} selectable>{card.period}</Text>
              <Text style={local.tierAccent} numberOfLines={1} selectable>{card.helper}</Text>
              <View style={[local.selectedPill, active && local.selectedPillActive]}>
                <Text style={[local.selectedPillText, active && local.selectedPillTextActive]} numberOfLines={1}>{active ? "Wybrane" : "Wybierz"}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={local.benefitsPanel}>
        <Text style={local.sectionTitle} selectable>Co zyskujesz</Text>
        {benefitRows.map(([icon, title, body]) => (
          <View key={title} style={local.benefitRow}>
            <View style={local.benefitIcon}>
              <MaterialCommunityIcons name={icon as any} size={18} color={colors.primary} />
            </View>
            <View style={styles.fill}>
              <Text style={local.benefitTitle} selectable>{title}</Text>
              <Text style={local.benefitText} selectable>{body}</Text>
            </View>
          </View>
        ))}
      </View>

      {!revenueCat.isPro && !hasPackages && (
        <View style={local.statusBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={19} color={colors.primaryDeep} />
          <View style={local.statusCopy}>
            <Text style={local.statusText} selectable>Nie udało się pobrać aktualnych pakietów z App Store.</Text>
            <Pressable accessibilityRole="button" disabled={busyAction !== null} onPress={() => void retryOfferings()} style={local.retryButton}>
              {busyAction === "offerings" ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="refresh" size={15} color={colors.primary} />}
              <Text style={local.retryText}>{busyAction === "offerings" ? "Pobieranie..." : "Spróbuj ponownie"}</Text>
            </Pressable>
          </View>
        </View>
      )}
      <Pressable disabled={primaryDisabled} onPress={() => void activateSelectedPlan()} style={[local.primaryCta, primaryDisabled && local.primaryCtaDisabled]}>
        <MaterialCommunityIcons name={(revenueCat.isPro ? "check" : "star-four-points") as any} size={18} color="#fff" />
        <Text style={local.primaryText}>{revenueCat.isPro ? "Spark Pro aktywny" : revenueCat.isLoading ? "Ładowanie pakietów..." : busyAction === "purchase" ? "Łączenie..." : !hasPackages ? "Pakiety chwilowo niedostępne" : "Kontynuuj za " + selectedPlanPrice}</Text>
      </Pressable>

      {!revenueCat.isPro && (
        <Text style={local.billingText} selectable>
          {premiumPlan === "lifetime"
            ? "Plan Lifetime jest zakupem jednorazowym bez automatycznego odnawiania."
            : "Subskrypcja odnawia si\u0119 automatycznie, je\u015bli nie anulujesz jej co najmniej 24 godziny przed ko\u0144cem okresu. Op\u0142ata zostanie pobrana z konta Apple ID. Subskrypcj\u0105 mo\u017cesz zarz\u0105dza\u0107 w ustawieniach App Store."}
        </Text>
      )}

      <View style={local.footerActions}>
        <Pressable accessibilityRole="button" disabled={busyAction !== null} onPress={() => void restorePro()} style={local.restoreButton}>
          <Text style={local.restoreText}>{busyAction === "restore" ? "Przywracanie..." : "Przywróć zakupy"}</Text>
        </Pressable>
        <View style={local.legalRow}>
          <Pressable onPress={() => openLegalDocument("Regulamin", legalLinks.terms, "EXPO_PUBLIC_TERMS_URL")}><Text style={local.legalText}>Regulamin</Text></Pressable>
          <Pressable onPress={() => openLegalDocument("Polityka prywatności", legalLinks.privacy, "EXPO_PUBLIC_PRIVACY_POLICY_URL")}><Text style={local.legalText}>Polityka prywatności</Text></Pressable>
        </View>
      </View>
    </View>
  );
}
function SocialHandleField({
  platform,
  label,
  value,
  onChangeText
}: {
  platform: keyof SocialHandles;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { colors, styles } = useAppTheme();
  const icon = getSocialIcon(platform);

  return (
    <View style={[styles.socialHandleField, { borderColor: icon.backgroundColor }]}>
      <View style={[styles.socialHandleIcon, { backgroundColor: icon.backgroundColor }]}>
        <SocialIcon label={platform} size={19} />
      </View>
      <View style={styles.fill}>
        <Text style={styles.socialHandleLabel}>{label}</Text>
        <View style={styles.socialHandleInputRow}>
          <Text style={styles.socialHandleAt}>@</Text>
          <TextInput
            value={value}
            onChangeText={(text) => onChangeText(normalizeSocialHandle(text))}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={40}
            placeholder="twoj.nick"
            placeholderTextColor={colors.muted}
            selectionColor="rgba(255,45,141,0.35)"
            cursorColor={colors.primary}
            style={styles.socialHandleInput}
          />
        </View>
      </View>
    </View>
  );
}
type ProfileViewerRange = "day" | "week" | "all";
type ProfileViewerSort = "recent" | "frequent";

function formatProfileViewTime(timestamp: number | null | undefined) {
  if (!timestamp) return "Ostatnio";
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Przed chwilą";
  if (minutes < 60) return String(minutes) + ' min temu';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return String(hours) + ' godz. temu';
  const days = Math.floor(hours / 24);
  if (days < 7) return String(days) + ' dni temu';
  return formatDate(timestamp);
}

function createProfileViewerStyles(colors: Palette) {
  return StyleSheet.create({
  panel: { gap: 14, padding: 18, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: "rgba(255,45,141,0.24)", boxShadow: `0 14px 34px ${colors.shadow}` },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  title: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  hint: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  badge: { minWidth: 34, height: 34, paddingHorizontal: 9, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  preview: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: colors.fillStrong },
  avatarStack: { width: 92, height: 52, position: "relative" },
  stackedAvatar: { position: "absolute", top: 2, width: 48, height: 48, borderRadius: 17, backgroundColor: colors.photoPlaceholder, borderWidth: 2, borderColor: "#17171d" },
  previewTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  previewMeta: { marginTop: 4, color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: "700" },
  empty: { minHeight: 90, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.035)" },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center", fontWeight: "700" },
  unlock: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 17, backgroundColor: colors.primary },
  unlockText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  openButton: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 17, backgroundColor: colors.primary },
  openButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  screen: { flex: 1, backgroundColor: "#07070a" },
  screenHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.fill },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: colors.fill, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  screenEyebrow: { color: colors.primary, fontSize: 9, letterSpacing: 0.8, fontWeight: "900" },
  screenTitle: { marginTop: 2, color: colors.ink, fontSize: 23, fontWeight: "900" },
  screenCount: { minWidth: 40, height: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.primarySoft },
  screenCountText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  controls: { gap: 12, padding: 16, paddingBottom: 10 },
  search: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 7 },
  filter: { flex: 1, minHeight: 39, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, borderRadius: 13, backgroundColor: colors.fill, borderWidth: 1, borderColor: colors.fill },
  filterActive: { backgroundColor: colors.primarySoft, borderColor: "rgba(255,45,141,0.36)" },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: "900" },
  filterTextActive: { color: colors.primary },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 17, paddingVertical: 8 },
  resultsText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  sort: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 34, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.fill },
  sortText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  list: { gap: 9, paddingHorizontal: 16, paddingTop: 4 },
  row: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, padding: 11, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: colors.fillStrong },
  rowAvatar: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.photoPlaceholder },
  rowName: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  rowMeta: { marginTop: 4, color: colors.muted, fontSize: 10, fontWeight: "700" },
  rowAside: { alignItems: "flex-end", gap: 6 },
  visits: { minHeight: 25, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.primarySoft },
  visitsText: { color: colors.primary, fontSize: 9, fontWeight: "900" },
  screenEmpty: { flex: 1, minHeight: 280, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 36 },
  screenEmptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  screenEmptyText: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", fontWeight: "700" }
});
}
const profileViewerSheets = { dark: createProfileViewerStyles(palettes.dark), light: createProfileViewerStyles(palettes.light) };

function ProfileViewersScreen({
  visible,
  viewers,
  viewerCount,
  loading,
  viewerInterests,
  onClose
}: {
  visible: boolean;
  viewers: MatchProfile[];
  viewerCount: number;
  loading: boolean;
  viewerInterests: string[];
  onClose: () => void;
}) {
  const profileViewerStyles = profileViewerSheets[useThemeState().name];
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<ProfileViewerRange>("all");
  const [sort, setSort] = useState<ProfileViewerSort>("recent");
  const [previewProfile, setPreviewProfile] = useState<MatchProfile | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");
  const filteredViewers = useMemo(() => {
    const now = Date.now();
    const rangeMs = range === "day" ? 86_400_000 : range === "week" ? 7 * 86_400_000 : null;
    return viewers
      .filter((viewer) => {
        if (rangeMs && (!viewer.profileLastViewedAtMs || now - viewer.profileLastViewedAtMs > rangeMs)) return false;
        if (!normalizedQuery) return true;
        const haystack = [
          viewer.name,
          viewer.surname,
          viewer.city,
          viewer.country,
          ...viewer.interests
        ].filter(Boolean).join(" ").toLocaleLowerCase("pl-PL");
        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => sort === "frequent"
        ? (right.profileViewCount ?? 1) - (left.profileViewCount ?? 1) || (right.profileLastViewedAtMs ?? 0) - (left.profileLastViewedAtMs ?? 0)
        : (right.profileLastViewedAtMs ?? 0) - (left.profileLastViewedAtMs ?? 0));
  }, [normalizedQuery, range, sort, viewers]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <LinearGradient colors={colors.backgroundGradient} style={profileViewerStyles.screen}>
        <StatusBar style={colors.statusBar} />
        <View style={[profileViewerStyles.screenHeader, { paddingTop: Math.max(insets.top, 12) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Wróć do profilu" onPress={onClose} style={profileViewerStyles.back}>
            <MaterialCommunityIcons name="chevron-left" size={25} color={colors.ink} />
          </Pressable>
          <View style={styles.fill}>
            <Text style={profileViewerStyles.screenEyebrow}>SPARK PRO</Text>
            <Text style={profileViewerStyles.screenTitle}>Kto Cię zauważył</Text>
          </View>
          <View style={profileViewerStyles.screenCount}><Text style={profileViewerStyles.screenCountText}>{viewerCount}</Text></View>
        </View>

        <View style={profileViewerStyles.controls}>
          <View style={profileViewerStyles.search}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Szukaj po nazwie, mieście lub zainteresowaniu"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={profileViewerStyles.searchInput}
            />
            {query.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Wyczyść wyszukiwanie" onPress={() => setQuery("")}>
                <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <View style={profileViewerStyles.filterRow}>
            {([
              ["day", "24 godz."],
              ["week", "7 dni"],
              ["all", "Wszystkie"]
            ] as [ProfileViewerRange, string][]).map(([value, label]) => (
              <Pressable key={value} accessibilityRole="button" onPress={() => setRange(value)} style={[profileViewerStyles.filter, range === value && profileViewerStyles.filterActive]}>
                <Text style={[profileViewerStyles.filterText, range === value && profileViewerStyles.filterTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={profileViewerStyles.resultsHeader}>
          <Text style={profileViewerStyles.resultsText}>{filteredViewers.length} wyników</Text>
          <Pressable accessibilityRole="button" onPress={() => setSort((value) => value === "recent" ? "frequent" : "recent")} style={profileViewerStyles.sort}>
            <MaterialCommunityIcons name={sort === "recent" ? "clock-outline" : "repeat"} size={14} color={colors.primary} />
            <Text style={profileViewerStyles.sortText}>{sort === "recent" ? "Najnowsze" : "Najczęstsze"}</Text>
          </Pressable>
        </View>

        <FlatList
          data={filteredViewers}
          keyExtractor={getProfileKey}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[profileViewerStyles.list, { paddingBottom: Math.max(insets.bottom, 14) + 18 }]}
          renderItem={({ item }) => {
            const displayName = [item.name, item.surname].filter(Boolean).join(" ");
            return (
              <Pressable accessibilityRole="button" accessibilityLabel={"Otwórz profil " + displayName} onPress={() => setPreviewProfile(item)} style={profileViewerStyles.row}>
                <Image source={item.image} style={profileViewerStyles.rowAvatar} contentFit="cover" />
                <View style={styles.fill}>
                  <Text style={profileViewerStyles.rowName} numberOfLines={1}>{displayName}, {item.age}</Text>
                  <Text style={profileViewerStyles.rowMeta} numberOfLines={1}>{[item.city, formatProfileViewTime(item.profileLastViewedAtMs)].filter(Boolean).join(" • ")}</Text>
                </View>
                <View style={profileViewerStyles.rowAside}>
                  <View style={profileViewerStyles.visits}><Text style={profileViewerStyles.visitsText}>{item.profileViewCount ?? 1} wizyt</Text></View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={profileViewerStyles.screenEmpty}>
              {loading ? <ActivityIndicator color={colors.primary} size="large" /> : <MaterialCommunityIcons name="account-search-outline" size={38} color={colors.primary} />}
              <Text style={profileViewerStyles.screenEmptyTitle}>{loading ? "Ładujemy wizyty" : "Brak pasujących osób"}</Text>
              <Text style={profileViewerStyles.screenEmptyText}>{loading ? "To potrwa tylko chwilę." : "Zmień filtr czasu albo wpisaną frazę."}</Text>
            </View>
          }
        />

        {previewProfile && (
          <ProfilePreviewSheet profile={previewProfile} viewerInterests={viewerInterests} onClose={() => setPreviewProfile(null)} canViewSocials={false} readOnly />
        )}
      </LinearGradient>
    </Modal>
  );
}

function ProfileViewerPanel({ hasPro, viewers, viewerCount, loading, viewerInterests, onUpgrade }: {
  hasPro: boolean;
  viewers: MatchProfile[];
  viewerCount: number;
  loading: boolean;
  viewerInterests: string[];
  onUpgrade: () => void;
}) {
  const profileViewerStyles = profileViewerSheets[useThemeState().name];
  const { colors, styles } = useAppTheme();
  const [screenOpen, setScreenOpen] = useState(false);
  const totalVisits = viewers.reduce((total, viewer) => total + (viewer.profileViewCount ?? 1), 0);
  return (
    <View style={profileViewerStyles.panel}>
      <View style={profileViewerStyles.header}>
        <View style={profileViewerStyles.icon}><MaterialCommunityIcons name="account-eye" size={23} color={colors.primary} /></View>
        <View style={styles.fill}>
          <Text style={profileViewerStyles.title}>Kto oglądał Twój profil</Text>
          <Text style={profileViewerStyles.hint}>{hasPro ? "Sprawdź osoby, które zatrzymały się przy Twojej karcie." : "Prywatna lista dostępna w Spark Pro."}</Text>
        </View>
        {hasPro && <View style={profileViewerStyles.badge}><Text style={profileViewerStyles.badgeText}>{viewerCount}</Text></View>}
      </View>
      {!hasPro ? (
        <Pressable accessibilityRole="button" onPress={onUpgrade} style={profileViewerStyles.unlock}>
          <MaterialCommunityIcons name="crown" size={18} color="#fff" />
          <Text style={profileViewerStyles.unlockText}>Odblokuj w Spark Pro</Text>
        </Pressable>
      ) : loading ? (
        <View style={profileViewerStyles.empty}><ActivityIndicator color={colors.primary} /><Text style={profileViewerStyles.emptyText}>Odświeżamy wizyty...</Text></View>
      ) : viewers.length === 0 ? (
        <View style={profileViewerStyles.empty}>
          <MaterialCommunityIcons name="eye-outline" size={23} color={colors.primary} />
          <Text style={profileViewerStyles.emptyTitle}>Jeszcze bez wizyt</Text>
          <Text style={profileViewerStyles.emptyText}>Gdy ktoś otworzy pełne szczegóły Twojego profilu, zobaczysz go tutaj.</Text>
        </View>
      ) : (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Otwórz listę odwiedzających profil" onPress={() => setScreenOpen(true)} style={profileViewerStyles.preview}>
            <View style={profileViewerStyles.avatarStack}>
              {viewers.slice(0, 3).map((viewer, index) => (
                <Image key={getProfileKey(viewer)} source={viewer.image} style={[profileViewerStyles.stackedAvatar, { left: index * 22, zIndex: 3 - index }]} contentFit="cover" />
              ))}
            </View>
            <View style={styles.fill}>
              <Text style={profileViewerStyles.previewTitle}>{viewerCount} osób • {totalVisits} wizyt</Text>
              <Text style={profileViewerStyles.previewMeta} numberOfLines={2}>Ostatnio: {viewers[0]?.name}. Dotknij, aby przeglądać i filtrować.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={21} color={colors.primary} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setScreenOpen(true)} style={profileViewerStyles.openButton}>
            <MaterialCommunityIcons name="account-search" size={18} color="#fff" />
            <Text style={profileViewerStyles.openButtonText}>Przeglądaj wszystkie wizyty</Text>
          </Pressable>
        </>
      )}
      <ProfileViewersScreen
        visible={screenOpen}
        viewers={viewers}
        viewerCount={viewerCount}
        loading={loading}
        viewerInterests={viewerInterests}
        onClose={() => setScreenOpen(false)}
      />
    </View>
  );
}

function ProfileScreen({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  profileNameMode,
  setProfileNameMode,
  nickname,
  setNickname,
  gender,
  setGender,
  birthDate,
  intents,
  setIntents,
  profileBio,
  setProfileBio,
  onBirthDateChange,
  discoverFilters,
  setDiscoverFilters,
  userCity,
  userCountry,
  locationStatus,
  locationBusy,
  onRequestLocation,
  activeEvents,
  onManageEvents,
  onOpenEventFeed,
  onLeaveEvent,
  email,
  selectedInterests,
  setSelectedInterests,
  userAge,
  setUserAge,
  profilePhotos,
  setProfilePhotos,
  profileName,
  socialHandles,
  setSocialHandles,
  hasPro,
  profileViewers,
  profileViewerCount,
  profileViewersLoading,
  openPremium,
  openCustomerCenter,
  openSafety,
  onSave,
  onSignOut,
  onInvite,
  verificationStatus,
  lgbt,
  lgbtBusy,
  onChangeLgbt
}: {
  lgbt: LgbtSettings | null;
  lgbtBusy: boolean;
  onChangeLgbt: (value: LgbtSettings) => void;
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  profileNameMode: ProfileNameMode;
  setProfileNameMode: (value: ProfileNameMode) => void;
  nickname: string;
  setNickname: (value: string) => void;
  gender: ProfileGender;
  setGender: (value: ProfileGender) => void;
  birthDate: string;
  intents: SparkIntent[];
  setIntents: (value: SparkIntent[]) => void;
  profileBio: string;
  setProfileBio: (value: string) => void;
  onBirthDateChange: (value: string) => void;
  discoverFilters: DiscoverFilters;
  setDiscoverFilters: React.Dispatch<React.SetStateAction<DiscoverFilters>>;
  userCity: string;
  userCountry: string;
  locationStatus: "idle" | "granted" | "denied";
  locationBusy: boolean;
  onRequestLocation: () => void;
  activeEvents: SparkEvent[];
  onManageEvents: () => void;
  onOpenEventFeed: () => void;
  onLeaveEvent: (eventId: string) => Promise<boolean>;
  email: string;
  selectedInterests: string[];
  setSelectedInterests: (value: string[]) => void;
  userAge: number;
  setUserAge: (value: number) => void;
  profilePhotos: ProfilePhoto[];
  setProfilePhotos: (value: ProfilePhoto[]) => void;
  profileName: string;
  socialHandles: SocialHandles;
  setSocialHandles: React.Dispatch<React.SetStateAction<SocialHandles>>;
  premiumPlan: SparkPlanId;
  hasPro: boolean;
  profileViewers: MatchProfile[];
  profileViewerCount: number;
  profileViewersLoading: boolean;
  openPremium: (source?: PremiumEntrySource) => void;
  openCustomerCenter: () => Promise<{ ok: boolean; message?: string }>;
  openSafety: () => void;
  onSave: () => Promise<boolean>;
  onSignOut: () => void;
  onInvite: () => void;
  verificationStatus: ProfileVerificationStatus;
}) {
  const { colors, styles, theme } = useAppTheme();
  const [saveBusy, setSaveBusy] = useState(false);
  const profileSaveInFlight = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [profileSection, setProfileSection] = useState<"overview" | "edit">("overview");
  const [leavingEventId, setLeavingEventId] = useState<string | null>(null);
  const maxPhotos = hasPro ? 15 : 3;
  const profileLocal = StyleSheet.create({
    eventHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    eventHeaderCopy: { flex: 1, gap: 3 },
    eventManage: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,45,141,0.12)" },
    eventManageText: { color: colors.primaryDeep, fontSize: 10, fontWeight: "900" },
    eventList: { gap: 8, marginTop: 12 },
    eventRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 62, padding: 10, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,45,141,0.16)" },
    eventIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,45,141,0.16)" },
    eventName: { color: colors.ink, fontSize: 12, fontWeight: "900" },
    eventMeta: { marginTop: 3, color: colors.muted, fontSize: 9, fontWeight: "700" },
    eventOpen: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    eventLeave: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
    eventEmpty: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: "rgba(255,45,141,0.07)" },
    eventEmptyText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: "700" }
  });
  const visiblePhotoCount = Math.min(profilePhotos.length, maxPhotos);
  const hiddenPhotoCount = Math.max(0, profilePhotos.length - maxPhotos);
  const previewPhoto = profilePhotos[0] ?? brandLogoImage;
  const previewSource = typeof previewPhoto === "string" ? { uri: previewPhoto } : previewPhoto;
  const previewPhotos = profilePhotos.length > 0
    ? profilePhotos.map((photo) => typeof photo === "string" ? { uri: photo } : photo)
    : [brandLogoImage];
  const ownPreviewProfile: MatchProfile = {
    id: "own-profile-preview",
    name: profileName,
    surname: "",
    age: userAge,
    city: userCity || "Twoja okolica",
    country: userCountry || undefined,
    bio: profileBio.trim() || "Poznajmy si\u0119 przez wsp\u00f3lne zainteresowania.",
    distance: [userCity, userCountry].filter(Boolean).join(", ") || "Lokalizacja ukryta",
    latitude: 0,
    longitude: 0,
    locationAvailable: false,
    image: previewSource,
    photos: previewPhotos,
    interests: selectedInterests,
    intent: intents[0],
    intents,
    gender,
    desiredGendersByIntent: discoverFilters.targetGendersByIntent,
    featuredInterests: selectedInterests.slice(0, 3),
    socials: socialHandlesToProfileSocials(socialHandles),
    premium: hasPro,
    verified: verificationStatus === "verified",
    desiredAgeMin: discoverFilters.ageMin,
    desiredAgeMax: discoverFilters.ageMax
  };
  const profileChecks = [profileName.trim().length >= 2, profileBio.trim().length >= 10, visiblePhotoCount > 0, selectedInterests.length >= 3];
  const profileCompletion = profileChecks.filter(Boolean).length;
  const profileStatusRows = [
    [String(visiblePhotoCount) + "/" + String(maxPhotos), "zdjęcia"],
    [String(selectedInterests.length) + "/15", "tagi"],
    [hasPro ? "Pro" : "Free", "plan"]
  ];

  async function pickProfilePhoto(index?: number) {
    if (profilePhotos.length >= maxPhotos && index === undefined) {
      Alert.alert("Zdjęcia", hasPro ? "Limit Premium to 15 zdjęć." : "Free ma limit 3 zdjęcia. Premium odblokuje 15.");
      return;
    }

    const uri = await pickImageFromLibrary();
    if (!uri) return;

    const next = [...profilePhotos];
    if (index !== undefined) {
      next[index] = uri;
    } else {
      next.push(uri);
    }
    setProfilePhotos(next.slice(0, maxPhotos));
  }

  function confirmRemovePhoto(index: number) {
    if (profilePhotos.length <= 1) {
      Alert.alert("Zdj\u0119cia", "Profil musi mie\u0107 co najmniej jedno zdj\u0119cie.");
      return;
    }

    Alert.alert(
      "Usu\u0144 zdj\u0119cie",
      index === 0 ? "Nast\u0119pne zdj\u0119cie stanie si\u0119 g\u0142\u00f3wnym." : "Czy chcesz usun\u0105\u0107 to zdj\u0119cie?",
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usu\u0144",
          style: "destructive",
          onPress: () => setProfilePhotos(profilePhotos.filter((_, photoIndex) => photoIndex !== index))
        }
      ]
    );
  }

  async function handleSaveProfile() {
    if (profileSaveInFlight.current) return;
    profileSaveInFlight.current = true; setSaveBusy(true);
    try {
      if (await onSave()) {
        Alert.alert("Profil zapisany", "Zmiany są już widoczne w Twoim profilu.");
        setProfileSection("overview");
      }
    } catch { Alert.alert("Nie udało się zapisać profilu", "Twoje zmiany są zachowane. Spróbuj ponownie."); }
    finally { profileSaveInFlight.current = false; setSaveBusy(false); }
  }

  function confirmLeaveEvent(event: SparkEvent) {
    Alert.alert(
      "Zrezygnować z wydarzenia?",
      "Profil zniknie z feedu „" + event.name + "”. Możesz dołączyć ponownie, dopóki wydarzenie jest aktywne.",
      [
        { text: "Zostań", style: "cancel" },
        {
          text: "Zrezygnuj",
          style: "destructive",
          onPress: () => {
            setLeavingEventId(event.id);
            void onLeaveEvent(event.id).finally(() => setLeavingEventId(null));
          }
        }
      ]
    );
  }
  return (
    <View style={styles.profileScreen}>
      <View style={styles.mxHeader}>
        <Text style={styles.mxTitle}>Profil</Text>
      </View>

      <View style={styles.pfIdentity}>
        <Pressable accessibilityRole="button" accessibilityLabel="Podgląd Twojej karty" onPress={() => setPreviewOpen(true)} style={({ pressed }) => [pressed && styles.controlPressed]}>
          <Image source={previewSource} style={styles.pfAvatar} contentFit="cover" />
        </Pressable>
        <View style={styles.pfNameRow}>
          <Text style={styles.pfName} numberOfLines={1}>{profileName}</Text>
          {verificationStatus === "verified" && <Pressable accessibilityRole="button" accessibilityLabel="Konto zweryfikowane" onPress={showVerifiedProfileInfo} hitSlop={8}><MaterialCommunityIcons name="check-decagram" size={20} color="#0a84ff" /></Pressable>}
          {hasPro && <MaterialCommunityIcons accessibilityLabel="Spark Pro" name="crown" size={18} color={colors.gold} />}
        </View>
        <Text style={styles.pfMeta} numberOfLines={1}>{[userAge + " lat", userCity].filter(Boolean).join(" · ")}</Text>
        <Pressable accessibilityRole="button" onPress={() => setPreviewOpen(true)} hitSlop={8}>
          <Text style={styles.pfLink}>Zobacz, jak widzą Cię inni</Text>
        </Pressable>
      </View>

      <View style={styles.cxSegment} accessibilityRole="tablist">
        {([["overview", "Przegląd"], ["edit", "Edytuj profil"]] as const).map(([value, label]) => {
          const active = profileSection === value;
          return (
            <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setProfileSection(value)} style={[styles.cxSegmentItem, active && styles.cxSegmentItemActive]}>
              <Text style={[styles.cxSegmentText, active && styles.cxSegmentTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {profileSection === "overview" && (
        <>
          {profileCompletion < profileChecks.length && (
            <View style={styles.mxGroup}>
              <Pressable accessibilityRole="button" accessibilityLabel="Uzupełnij profil" onPress={() => setProfileSection("edit")} style={({ pressed }) => [styles.pfRow, pressed && { backgroundColor: colors.fill }]}>
                <View style={[styles.pfRowIcon, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="account-edit" size={17} color="#fff" /></View>
                <View style={styles.fill}>
                  <Text style={styles.pfRowLabel}>Uzupełnij profil</Text>
                  <View style={styles.pfProgress}><View style={[styles.pfProgressFill, { width: `${profileCompletion * 25}%` }]} /></View>
                </View>
                <Text style={styles.pfRowValue}>{profileCompletion}/4</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
              </Pressable>
            </View>
          )}

          <View style={styles.mxSection}>
            <Text style={styles.mxSectionTitle}>Wydarzenia</Text>
            <View style={styles.mxGroup}>
              {activeEvents.slice(0, 3).map((event) => (
                <React.Fragment key={event.id}>
                  <Pressable accessibilityRole="button" accessibilityLabel={"Otwórz feed " + event.name} onPress={onOpenEventFeed} style={({ pressed }) => [styles.pfRow, pressed && { backgroundColor: colors.fill }]}>
                    <View style={[styles.pfRowIcon, { backgroundColor: colors.event }]}><MaterialCommunityIcons name={event.icon as any} size={17} color="#fff" /></View>
                    <View style={styles.fill}>
                      <Text style={styles.pfRowLabel} numberOfLines={1}>{event.name}</Text>
                      <Text style={styles.pfRowSub} numberOfLines={1}>{formatEventDateRange(event)} · {event.city}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={"Zrezygnuj z " + event.name} disabled={leavingEventId === event.id} onPress={(pressEvent) => { pressEvent.stopPropagation(); confirmLeaveEvent(event); }} hitSlop={8} style={styles.mxQuiet}>
                      {leavingEventId === event.id ? <ActivityIndicator size="small" color={colors.muted} /> : <MaterialCommunityIcons name="close" size={18} color={colors.muted} />}
                    </Pressable>
                  </Pressable>
                  <View style={styles.pfDivider} />
                </React.Fragment>
              ))}
              <Pressable accessibilityRole="button" onPress={onManageEvents} style={({ pressed }) => [styles.pfRow, pressed && { backgroundColor: colors.fill }]}>
                <View style={[styles.pfRowIcon, { backgroundColor: colors.event }]}><MaterialCommunityIcons name="calendar-plus" size={17} color="#fff" /></View>
                <Text style={[styles.pfRowLabel, styles.fill]}>{activeEvents.length > 0 ? "Zarządzaj wydarzeniami" : "Wybierz wydarzenie"}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
              </Pressable>
            </View>
          </View>

      {hasPro ? (
        <ProfileViewerPanel
          hasPro={hasPro}
          viewers={profileViewers}
          viewerCount={profileViewerCount}
          loading={profileViewersLoading}
          viewerInterests={selectedInterests}
          onUpgrade={() => openPremium("profile_views")}
        />
      ) : (
        <View style={styles.mxGroup}>
          <Pressable accessibilityRole="button" onPress={() => openPremium("profile_views")} style={({ pressed }) => [styles.pfRow, pressed && { backgroundColor: colors.fill }]}>
            <View style={[styles.pfRowIcon, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="eye-outline" size={17} color="#fff" /></View>
            <View style={styles.fill}>
              <Text style={styles.pfRowLabel}>Kto oglądał Twój profil</Text>
              <Text style={styles.pfRowSub}>Dostępne w Spark Pro</Text>
            </View>
            <MaterialCommunityIcons name="lock-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>
      )}

          <View style={styles.mxGroup}>
            {([
              ["image-multiple-outline", colors.primary, "Udostępnij swoją kartę", "Story bez nazwiska i lokalizacji", () => setShareCardOpen(true)],
              ["account-multiple-plus", colors.friends, "Zaproś znajomych", undefined, onInvite]
            ] as const).map(([icon, tint, label, sub, onPress], index) => (
              <React.Fragment key={label}>
                {index > 0 && <View style={styles.pfDivider} />}
                <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.pfRow, pressed && { backgroundColor: colors.fill }]}>
                  <View style={[styles.pfRowIcon, { backgroundColor: tint }]}><MaterialCommunityIcons name={icon} size={17} color="#fff" /></View>
                  <View style={styles.fill}>
                    <Text style={styles.pfRowLabel}>{label}</Text>
                    {sub ? <Text style={styles.pfRowSub}>{sub}</Text> : null}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              </React.Fragment>
            ))}
          </View>

          <View style={styles.mxGroup}>
            {([
              ["crown", colors.gold, "Spark Pro", hasPro ? "Aktywne" : "Zobacz", () => openPremium()],
              ["credit-card-outline", "#34c759", "Subskrypcja", "Zarządzaj", async () => {
                const result = await openCustomerCenter();
                if (!result.ok && result.message) Alert.alert("Subskrypcja", result.message);
              }],
              [verificationStatus === "verified" ? "check-decagram" : "shield-account-outline", "#0a84ff", "Weryfikacja", verificationStatus === "verified" ? "Zweryfikowane" : "Brak", showVerifiedProfileInfo],
              ["cog-outline", "#8e8e93", "Ustawienia", "", openSafety]
            ] as const).map(([icon, tint, label, value, onPress], index) => (
              <React.Fragment key={label}>
                {index > 0 && <View style={styles.pfDivider} />}
                <Pressable accessibilityRole="button" onPress={() => { void onPress(); }} style={({ pressed }) => [styles.pfRow, pressed && { backgroundColor: colors.fill }]}>
                  <View style={[styles.pfRowIcon, { backgroundColor: tint }]}><MaterialCommunityIcons name={icon as any} size={17} color="#fff" /></View>
                  <Text style={[styles.pfRowLabel, styles.fill]}>{label}</Text>
                  {value ? <Text style={styles.pfRowValue}>{value}</Text> : null}
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              </React.Fragment>
            ))}
            <View style={styles.pfDivider} />
            <View style={[styles.pfRow, { flexWrap: "wrap" }]}>
              <View style={[styles.pfRowIcon, { backgroundColor: "#8e8e93" }]}><MaterialCommunityIcons name="theme-light-dark" size={17} color="#fff" /></View>
              <Text style={[styles.pfRowLabel, styles.fill]}>Wygląd</Text>
              <View style={[styles.cxSegment, { flexBasis: "100%", marginTop: 4 }]}>
                {([["system", "Jak telefon"], ["light", "Jasny"], ["dark", "Ciemny"]] as const).map(([value, label]) => {
                  const active = theme.preference === value;
                  return (
                    <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { tap(); theme.setPreference(value); }} style={[styles.cxSegmentItem, active && styles.cxSegmentItemActive]}>
                      <Text style={[styles.cxSegmentText, active && styles.cxSegmentTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.mxGroup}>
            <Pressable accessibilityRole="button" onPress={onSignOut} style={({ pressed }) => [styles.pfRow, { justifyContent: "center" }, pressed && { backgroundColor: colors.fill }]}>
              <Text style={styles.pfSignOut}>Wyloguj się</Text>
            </Pressable>
          </View>
          <Text style={styles.pfFootnote} numberOfLines={1}>{email}</Text>
        </>
      )}

      {profileSection === "edit" && (
        <>
          <View style={styles.profilePanel}>
        <View style={styles.profileSectionHeader}>
          <View style={styles.fill}>
            <Text style={styles.eyebrow} selectable>Podstawy</Text>
            <Text style={styles.profileDescription} selectable>Wybierz nazwę, którą inni zobaczą na Twojej karcie.</Text>
          </View>
          <Text style={styles.profilePlanBadge} selectable>{hasPro ? "PRO" : "FREE"}</Text>
        </View>
        <View style={styles.segmentedChoice}>
          <Pressable onPress={() => setProfileNameMode("realName")} style={[styles.segmentedChoiceItem, profileNameMode === "realName" && styles.segmentedChoiceItemActive]}><Text style={[styles.segmentedChoiceText, profileNameMode === "realName" && styles.segmentedChoiceTextActive]}>Imię i nazwisko</Text></Pressable>
          <Pressable onPress={() => setProfileNameMode("nickname")} style={[styles.segmentedChoiceItem, profileNameMode === "nickname" && styles.segmentedChoiceItemActive]}><Text style={[styles.segmentedChoiceText, profileNameMode === "nickname" && styles.segmentedChoiceTextActive]}>Nick</Text></Pressable>
        </View>
        {profileNameMode === "realName" ? <View style={styles.nameRow}><TextField label="Imię" value={firstName} onChangeText={setFirstName} /><TextField label="Nazwisko" value={lastName} onChangeText={setLastName} /></View> : <TextField label="Nick" value={nickname} onChangeText={setNickname} />}
        <Text style={styles.fieldLabel}>Twoja płeć</Text>
        <GenderIdentitySelect value={gender} onChange={setGender} compact />
        <TextField label="Data urodzenia (RRRR-MM-DD)" value={birthDate} onChangeText={onBirthDateChange} keyboardType="numeric" />
        <Text style={styles.setupHelper}>{calculateAge(birthDate) === null ? "Podaj prawidłową datę." : (calculateAge(birthDate) ?? 0) > 99 ? "Sprawdź rok urodzenia." : String(calculateAge(birthDate)) + " lat"}</Text>
        <ProfileBioInput value={profileBio} onChangeText={setProfileBio} />
        <LocationControl city={userCity} country={userCountry} status={locationStatus} busy={locationBusy} onPress={onRequestLocation} />
      </View>

      <View style={styles.profilePanel}>
        <View style={styles.profileSectionHeader}>
          <View style={styles.fill}>
            <Text style={styles.eyebrow}>Twój cel</Text>
            <Text style={styles.panelTitle}>Kogo chcesz poznać?</Text>
            <Text style={styles.profileDescription}>Możesz połączyć kilka kategorii. Zmiany zapiszesz przyciskiem na dole.</Text>
          </View>
          <MaterialCommunityIcons name="account-heart-outline" size={22} color={colors.primary} />
        </View>
        <IntentMultiSelect selected={intents} onChange={setIntents} />
        <LgbtSettingsPanel value={lgbt} onChange={onChangeLgbt} />
        <Text style={styles.profileDescription}>{lgbtBusy ? "Zapisywanie tagu…" : "Kogo widzisz w Odkrywaj (płeć, wiek, odległość) ustawiasz w Filtrach na ekranie Odkrywaj."}</Text>
      </View>

      <View style={styles.profilePanel}>
        <View style={styles.profileSectionHeader}>
          <View style={styles.fill}>
            <Text style={styles.eyebrow}>Social media</Text>
            <Text style={styles.profileDescription}>{"Dodaj same nicki. Bez link\u00f3w i adres\u00f3w URL."}</Text>
          </View>
          <MaterialCommunityIcons name="at" size={22} color={colors.primary} />
        </View>
        <View style={styles.socialHandleGrid}>
          <SocialHandleField platform="instagram" label="Instagram" value={socialHandles.instagram} onChangeText={(value) => setSocialHandles((current) => ({ ...current, instagram: value }))} />
          <SocialHandleField platform="tiktok" label="TikTok" value={socialHandles.tiktok} onChangeText={(value) => setSocialHandles((current) => ({ ...current, tiktok: value }))} />
          <SocialHandleField platform="facebook" label="Facebook" value={socialHandles.facebook} onChangeText={(value) => setSocialHandles((current) => ({ ...current, facebook: value }))} />
        </View>
        <Text style={styles.socialHandleHint}>{"Nicki zobacz\u0105 dopiero osoby, z kt\u00f3rymi masz match."}</Text>
      </View>

      <View style={styles.profileGalleryPanel}>
        <View style={styles.profileGalleryHeader}>
          <View style={styles.fill}>
            <Text style={styles.panelTitle} selectable>Zdjęcia</Text>
            <Text style={styles.photoFormatHint} selectable>{visiblePhotoCount}/{maxPhotos} zdjęć - format 4:5</Text>
            <Text style={styles.photoProHint} selectable>{hasPro ? "Spark Pro: limit 15 zdj\u0119\u0107 aktywny" : hiddenPhotoCount > 0 ? `${hiddenPhotoCount} zdj\u0119\u0107 zachowanych - odblokuj Pro, aby je ponownie pokaza\u0107` : "Spark Pro odblokuje do 15 zdj\u0119\u0107"}</Text>
          </View>
          <Pressable onPress={() => (profilePhotos.length >= maxPhotos && !hasPro ? openPremium("photos") : pickProfilePhoto())} style={styles.photoAddButton}>
            <MaterialCommunityIcons name={profilePhotos.length >= maxPhotos ? "lock" : "plus"} size={16} color="#fff" />
            <Text style={styles.photoAddText}>{profilePhotos.length >= maxPhotos ? "Limit" : "Dodaj"}</Text>
          </Pressable>
        </View>
        <View style={styles.photoGrid}>
          {Array.from({ length: Math.min(maxPhotos, Math.max(hasPro ? 6 : 3, profilePhotos.length + 1)) }).map((_, index) => {
            const image = profilePhotos[index];
            const source = typeof image === "string" ? { uri: image } : image;

            return (
              <Pressable key={index} onPress={() => pickProfilePhoto(image ? index : undefined)} style={styles.photoSlot}>
                {source ? <Image source={source} style={styles.photoSlotImage} contentFit="cover" /> : <View style={styles.photoEmptyState}><MaterialCommunityIcons name="camera-plus" size={24} color={colors.primary} /></View>}
                {image && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Usuń zdjęcie"
                    onPress={(event) => {
                      event.stopPropagation();
                      confirmRemovePhoto(index);
                    }}
                    style={styles.photoRemoveButton}
                  >
                    <MaterialCommunityIcons name="close" size={16} color="#fff" />
                  </Pressable>
                )}
                <Text style={styles.photoSlotBadge} selectable>{index === 0 ? "Główne" : image ? "Foto " + (index + 1) : "Dodaj"}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>


      <View style={styles.panel}>
        <Text style={styles.panelTitle} selectable>Zainteresowania</Text>
        <Text style={styles.panelText} selectable>Wybierz 3-15 tagów w kategoriach. Pierwsze wybrane pokazują się na karcie.</Text>
        <CategorizedInterestPicker selected={selectedInterests} onToggle={(item) => setSelectedInterests(toggleListItem(selectedInterests, item))} maxSelected={15} />
      </View>

      <Pressable accessibilityRole="button" disabled={saveBusy} onPress={() => void handleSaveProfile()} style={[styles.primaryButton, saveBusy && styles.primaryButtonDisabled]}>
        <MaterialCommunityIcons name="content-save" size={19} color="#fff" />
        <Text style={styles.primaryButtonText}>{saveBusy ? "Zapisywanie..." : "Zapisz zmiany"}</Text>
      </Pressable>
        </>
      )}

      {previewOpen && (
        <ProfilePreviewSheet
          profile={ownPreviewProfile}
          viewerInterests={[]}
          onClose={() => setPreviewOpen(false)}
          canViewSocials
          isOwnProfile
        />
      )}
      <ShareProfileCardModal visible={shareCardOpen} profile={ownPreviewProfile} onClose={() => setShareCardOpen(false)} />
    </View>
  );
}

function ShareProfileCardModal({
  visible,
  profile,
  onClose
}: {
  visible: boolean;
  profile: MatchProfile;
  onClose: () => void;
}) {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const [sharing, setSharing] = useState(false);
  const featuredInterests = getFeaturedInterests(profile).slice(0, 3);
  const availableCardHeight = Math.max(390, height - Math.max(insets.top, 10) - Math.max(insets.bottom, 10) - 250);
  const cardWidth = Math.max(220, Math.min(width - 28, 360, (availableCardHeight * 9) / 16));
  const cardHeight = cardWidth * 16 / 9;
  const local = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { width: "100%", minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
    close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.075)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    headerTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
    headerSpacer: { width: 40 },
    stage: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
    card: { overflow: "hidden", borderRadius: 26, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "#111116", boxShadow: "0 24px 64px rgba(255,45,141,0.28)" },
    photo: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    photoVeil: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    content: { flex: 1, justifyContent: "space-between", padding: 18 },
    logoTile: { width: 58, height: 58, overflow: "hidden", borderRadius: 17, borderCurve: "continuous", backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.7)" },
    logo: { width: "100%", height: "100%" },
    bottom: { gap: 12 },
    invite: { maxWidth: "94%", color: "#fff", fontSize: 34, lineHeight: 37, fontWeight: "900" },
    interests: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    interest: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.scrim, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
    interestText: { color: "#fff", fontSize: 9, fontWeight: "900" },
    install: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)" },
    installLabel: { color: "rgba(255,255,255,0.9)", fontSize: 10, fontWeight: "900" },
    footer: { width: "100%", paddingHorizontal: 18, paddingTop: 8, gap: 8 },
    shareButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 18, borderCurve: "continuous", backgroundColor: colors.primary, boxShadow: "0 12px 30px rgba(255,45,141,0.28)" },
    shareText: { color: "#fff", fontSize: 14, fontWeight: "900" },
    inviteButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    inviteText: { color: colors.primaryDeep, fontSize: 11, fontWeight: "900" }
  });

  useEffect(() => {
    if (!visible) return;
    entrance.setValue(0);
    Animated.spring(entrance, { toValue: 1, damping: 17, stiffness: 155, useNativeDriver: true }).start();
  }, [entrance, visible]);

  async function shareCard() {
    if (sharing) return;
    setSharing(true);
    try {
      if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
        await shareSparkInvite();
        return;
      }
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        width: 1080,
        height: 1920
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Sharing.shareAsync(uri, {
        dialogTitle: "Udostępnij kartę Spark",
        mimeType: "image/png",
        UTI: "public.png"
      });
    } catch {
      Alert.alert("Karta Spark", "Nie udało się utworzyć obrazu. Spróbuj ponownie po pełnym załadowaniu zdjęcia.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={[local.root, { paddingTop: Math.max(insets.top, 10), paddingBottom: Math.max(insets.bottom, 10) }]}>
        <StatusBar style={colors.statusBar} />
        <View style={local.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zamknij kartę" onPress={onClose} style={local.close}>
            <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
          </Pressable>
          <Text style={local.headerTitle}>Udostępnij profil</Text>
          <View style={local.headerSpacer} />
        </View>
        <View style={local.stage}>
          <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
            <View ref={cardRef} collapsable={false} style={[local.card, { width: cardWidth, height: cardHeight }]}>
              <Image source={profile.image} style={local.photo} contentFit="cover" transition={0} />
              <LinearGradient colors={["rgba(3,3,5,0.08)", "rgba(3,3,5,0.03)", "rgba(5,5,7,0.96)"]} locations={[0, 0.46, 1]} style={local.photoVeil} />
              <View style={local.content}>
                <View style={local.logoTile}>
                  <Image source={brandLogoImage} style={local.logo} contentFit="cover" transition={0} />
                </View>
                <View style={local.bottom}>
                  <Text style={local.invite}>Dołącz ze mną{String.fromCharCode(10)}do Spark!</Text>
                  <View style={local.interests}>
                    {featuredInterests.map((interest) => (
                      <View key={interest} style={local.interest}>
                        <MaterialCommunityIcons name={getInterestIcon(interest, "star-four-points") as any} size={11} color="#ff8fc4" />
                        <Text style={local.interestText} numberOfLines={1}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={local.install}>
                    <Text style={local.installLabel}>Pobierz Spark w App Store</Text>
                    <MaterialCommunityIcons name="arrow-top-right" size={17} color="#fff" />
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
        <View style={local.footer}>
          <Pressable accessibilityRole="button" disabled={sharing} onPress={() => { void shareCard(); }} style={[local.shareButton, sharing && styles.primaryButtonDisabled]}>
            {sharing ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="share-variant" size={19} color="#fff" />}
            <Text style={local.shareText}>{sharing ? "Tworzenie karty..." : "Udostępnij kartę"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { void shareSparkInvite(); }} style={local.inviteButton}>
            <MaterialCommunityIcons name="link-variant" size={17} color={colors.primaryDeep} />
            <Text style={local.inviteText}>Wyślij link do aplikacji</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SimpleInterestPicker({ selected, onToggle, maxSelected = 15 }: { selected: string[]; onToggle: (item: string) => void; maxSelected?: number }) {
  const { colors, styles } = useAppTheme();
  const [showAll, setShowAll] = useState(false);
  const starterOptions = Array.from(new Set([
    ...interestCategories[0].items,
    ...interestCategories[1].items.slice(0, 8),
    ...interestCategories[7].items.slice(0, 2)
  ]));
  const visibleOptions = Array.from(new Set([...selected, ...(showAll ? interestOptions : starterOptions)])).filter((item) => (interestOptions as readonly string[]).includes(item) && !selected.includes(item));
  function handleToggle(item: string) {
    if (!selected.includes(item) && selected.length >= maxSelected) {
      Alert.alert("Zainteresowania", "Możesz wybrać maksymalnie " + maxSelected + " zainteresowań.");
      return;
    }

    onToggle(item);
  }

  return (
    <View style={styles.simpleInterestBox}>
      <View style={styles.simpleInterestTop}>
        <Text style={styles.simpleInterestCount} selectable>{selected.length}/{maxSelected}</Text>
        <Text style={styles.simpleInterestHint} selectable>{selected.length < 3 ? "Dodaj jeszcze kilka tagów" : "Gotowe do dopasowań"}</Text>
      </View>
      {selected.length > 0 ? (
        <View style={styles.chipWrap}>
          {selected.map((item, index) => {
            const theme = getInterestTheme(item, index);
            return (
              <Pressable key={item} onPress={() => handleToggle(item)} style={[styles.chip, styles.chipActive, { backgroundColor: theme.active, borderColor: theme.border }]}>
                <MaterialCommunityIcons name="check" size={14} color="#fff" />
                <Text style={[styles.chipText, { color: "#fff" }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.selectedInterestEmpty} selectable>Nie masz jeszcze wybranych tagów.</Text>
      )}
      <View style={styles.simpleInterestDivider} />
      <View style={styles.chipWrap}>
        {visibleOptions.map((item, index) => {
          const isSelected = selected.includes(item);
          const theme = getInterestTheme(item, index);
          const limitReached = !isSelected && selected.length >= maxSelected;

          return (
            <Pressable
              key={item}
              onPress={() => handleToggle(item)}
              style={[
                styles.chip,
                { backgroundColor: isSelected ? theme.active : theme.soft, borderColor: theme.border },
                isSelected && styles.chipActive,
                limitReached && { opacity: 0.42 }
              ]}
            >
              <View style={[styles.chipDot, { backgroundColor: isSelected ? "#fff" : theme.active }]} />
              <Text style={[styles.chipText, { color: isSelected ? "#fff" : colors.ink }]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={() => setShowAll((value) => !value)} style={styles.simpleInterestMoreButton}>
        <Text style={styles.simpleInterestMoreText}>{showAll ? "Pokaż mniej" : "Pokaż więcej tagów"}</Text>
        <MaterialCommunityIcons name={showAll ? "chevron-up" : "chevron-down"} size={18} color={colors.primaryDeep} />
      </Pressable>
    </View>
  );
}

function InterestChips({ selected, onToggle, maxSelected = 15 }: { selected: string[]; onToggle: (item: string) => void; maxSelected?: number }) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={styles.chipWrap}>
      {interestOptions.map((item, index) => {
        const isSelected = selected.includes(item);
        const theme = getInterestTheme(item, index);
        const limitReached = !isSelected && selected.length >= maxSelected;

        return (
          <Pressable
            key={item}
            onPress={() => {
              if (limitReached) {
                Alert.alert("Zainteresowania", `Możesz wybrać maksymalnie ${maxSelected} zainteresowań.`);
                return;
              }

              onToggle(item);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? theme.active : theme.soft,
                borderColor: theme.border
              },
              isSelected && styles.chipActive,
              limitReached && { opacity: 0.42 }
            ]}
          >
            <View style={[styles.chipDot, { backgroundColor: isSelected ? "#fff" : theme.active }]} />
            <Text style={[styles.chipText, { color: isSelected ? "#fff" : colors.ink }]}>{item}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CategorizedInterestPicker({ selected, onToggle, maxSelected = 15 }: { selected: string[]; onToggle: (item: string) => void; maxSelected?: number }) {
  const { colors, styles } = useAppTheme();
  const initialCategory = interestCategories.find((category) => category.items.some((item) => selected.includes(item))) ?? interestCategories[0];
  const [activeCategoryTitle, setActiveCategoryTitle] = useState(initialCategory.title);
  const activeCategory = interestCategories.find((category) => category.title === activeCategoryTitle) ?? interestCategories[0];
  const activeCategoryIndex = interestCategories.findIndex((category) => category.title === activeCategory.title);

  function handleToggle(item: string) {
    if (!selected.includes(item) && selected.length >= maxSelected) {
      Alert.alert("Zainteresowania", `Możesz wybrać maksymalnie ${maxSelected} zainteresowań.`);
      return;
    }

    tap();
    onToggle(item);
  }

  return (
    <View style={styles.interestPicker}>
      <View style={styles.interestCategoryGrid}>
        {interestCategories.map((category) => {
          const isActive = category.title === activeCategory.title;
          const selectedInCategory = category.items.filter((item) => selected.includes(item)).length;

          return (
            <Pressable
              key={category.title}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => {
                tap();
                setActiveCategoryTitle(category.title);
              }}
              style={({ pressed }) => [
                styles.interestCategoryTile,
                isActive && styles.interestCategoryTileActive,
                pressed && styles.controlPressed
              ]}
            >
              <View style={[styles.interestCategoryIcon, isActive && styles.interestCategoryIconActive]}>
                <MaterialCommunityIcons name={category.icon as any} size={23} color={isActive ? "#fff" : colors.primary} />
              </View>
              <Text style={[styles.interestCategoryTitle, isActive && styles.interestCategoryTitleActive]} numberOfLines={2}>{category.title}</Text>
              <View style={styles.interestCategoryTileFooter}>
                <Text style={styles.interestCategoryMeta}>{selectedInCategory ? `${selectedInCategory} wybrano` : `${category.items.length} opcji`}</Text>
                {selectedInCategory > 0 && (
                  <View style={styles.interestCategoryCount}>
                    <Text style={styles.interestCategoryCountText}>{selectedInCategory}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.interestOptionsPanel}>
        <View style={styles.interestOptionsHeader}>
          <View>
            <Text style={styles.interestOptionsEyebrow}>WYBIERZ ZAINTERESOWANIA</Text>
            <Text style={styles.interestOptionsTitle}>{activeCategory.title}</Text>
          </View>
          <Text style={styles.interestOptionsCounter}>{selected.length}/{maxSelected}</Text>
        </View>
        <View style={styles.interestOptionsGrid}>
          {activeCategory.items.map((item, index) => {
            const isSelected = selected.includes(item);
            const theme = getInterestTheme(item, activeCategoryIndex * 16 + index);
            const limitReached = !isSelected && selected.length >= maxSelected;

            return (
              <Pressable
                key={item}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected, disabled: limitReached }}
                onPress={() => handleToggle(item)}
                style={({ pressed }) => [
                  styles.interestOptionTile,
                  { backgroundColor: isSelected ? theme.active : theme.soft, borderColor: isSelected ? theme.active : theme.border },
                  limitReached && styles.interestOptionTileDisabled,
                  pressed && styles.controlPressed
                ]}
              >
                <View style={[styles.interestOptionIcon, { backgroundColor: isSelected ? "rgba(255,255,255,0.18)" : theme.border }]}>
                  <MaterialCommunityIcons name={getInterestIcon(item, activeCategory.icon) as any} size={20} color={isSelected ? "#fff" : theme.active} />
                </View>
                <Text style={[styles.interestOptionText, isSelected && styles.interestOptionTextActive]} numberOfLines={2}>{item}</Text>
                <MaterialCommunityIcons name={isSelected ? "check-circle" : "plus-circle-outline"} size={18} color={isSelected ? "#fff" : theme.active} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
function TextField({ label, value, onChangeText, secureTextEntry = false, keyboardType = "default", passwordMode = "current-password" }: { label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; keyboardType?: "default" | "email-address" | "numeric"; passwordMode?: "current-password" | "new-password" }) {
  const { colors, styles } = useAppTheme();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel} selectable>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword && !passwordVisible}
          keyboardType={keyboardType}
          autoCorrect={false}
          autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
          autoComplete={keyboardType === "email-address" ? "email" : isPassword ? passwordMode : "off"}
          importantForAutofill={keyboardType === "email-address" || isPassword ? "yes" : "no"}
          textContentType={keyboardType === "email-address" ? "emailAddress" : isPassword ? (passwordMode === "new-password" ? "newPassword" : "password") : "none"}
          selectionColor="rgba(255,45,141,0.35)"
          cursorColor={colors.primary}
          placeholderTextColor={colors.muted}
          style={[styles.fieldInput, isPassword && styles.fieldInputWithIcon]}
        />
        {isPassword && (
          <Pressable accessibilityRole="button" onPress={() => setPasswordVisible((visible) => !visible)} style={styles.passwordToggle}>
            <MaterialCommunityIcons name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
function BlockedProfilesModal({
  visible,
  blockedProfileKeys,
  onClose,
  onUnblock,
  onReport
}: {
  visible: boolean;
  blockedProfileKeys: string[];
  onClose: () => void;
  onUnblock: (profileKey: string) => Promise<boolean>;
  onReport: (profileKey: string, reason?: string) => Promise<boolean>;
}) {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Array<{ key: string; profile: MatchProfile | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [previewProfile, setPreviewProfile] = useState<MatchProfile | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (blockedProfileKeys.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void getPublicProfiles(blockedProfileKeys).then((documents) => {
      if (!active) return;
      setEntries(blockedProfileKeys.map((key, index) => ({
        key,
        profile: documents[index] ? mapRemoteProfile(documents[index] as Record<string, unknown>) : null
      })));
    }).catch(() => {
      if (active) setEntries(blockedProfileKeys.map((key) => ({ key, profile: null })));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [blockedProfileKeys.join("|"), visible]);

  const local = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
    back: { width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" },
    title: { color: colors.ink, fontSize: 19, fontWeight: "900" },
    subtitle: { marginTop: 2, color: colors.muted, fontSize: 10, fontWeight: "700" },
    count: { minWidth: 34, height: 28, textAlign: "center", textAlignVertical: "center", paddingHorizontal: 9, borderRadius: 999, color: "#ff8298", backgroundColor: "rgba(255,77,109,0.13)", fontSize: 10, fontWeight: "900" },
    content: { gap: 10, padding: 14 },
    intro: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 18, backgroundColor: "rgba(255,77,109,0.08)", borderWidth: 1, borderColor: "rgba(255,77,109,0.2)" },
    introText: { flex: 1, color: "#d9c9d1", fontSize: 10, lineHeight: 15, fontWeight: "700" },
    item: { gap: 11, padding: 13, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,77,109,0.18)" },
    itemTop: { flexDirection: "row", alignItems: "center", gap: 11 },
    avatar: { width: 52, height: 52, borderRadius: 17, borderCurve: "continuous", opacity: 0.78 },
    avatarFallback: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,77,109,0.12)" },
    name: { color: colors.ink, fontSize: 14, fontWeight: "900" },
    meta: { marginTop: 3, color: colors.muted, fontSize: 10, fontWeight: "700" },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,77,109,0.13)" },
    badgeText: { color: "#ff8298", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
    actions: { flexDirection: "row", gap: 8 },
    action: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.06)" },
    actionDanger: { backgroundColor: "rgba(255,77,109,0.11)" },
    actionText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
    actionDangerText: { color: "#ff8298" },
    empty: { alignItems: "center", gap: 10, paddingVertical: 70, paddingHorizontal: 24 },
    emptyIcon: { width: 68, height: 68, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(66,217,130,0.1)" },
    emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", textAlign: "center" },
    emptyText: { color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: "700", textAlign: "center" }
  });

  function confirmUnblock(entry: { key: string; profile: MatchProfile | null }) {
    const name = entry.profile ? [entry.profile.name, entry.profile.surname].filter(Boolean).join(" ") : "tę osobę";
    Alert.alert("Odblokuj profil", "Odblokować " + name + "? Profil może ponownie pojawić się w odkrywaniu, ale stary match nie zostanie automatycznie przywrócony.", [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Odblokuj",
        onPress: () => {
          setBusyKey(entry.key);
          void onUnblock(entry.key).finally(() => setBusyKey(null));
        }
      }
    ]);
  }

  function report(entry: { key: string; profile: MatchProfile | null }) {
    const name = entry.profile?.name ?? "ten profil";
    Alert.alert("Zgłoś profil", "Wybierz powód zgłoszenia: " + name + ".", [
      { text: "Spam", onPress: () => { void onReport(entry.key, "Spam lub reklamy"); } },
      { text: "Nękanie", onPress: () => { void onReport(entry.key, "Nękanie lub obraźliwe zachowanie"); } },
      { text: "Fałszywy profil", onPress: () => { void onReport(entry.key, "Fałszywy profil"); } },
      { text: "Anuluj", style: "cancel" }
    ]);
  }

  return (
    <>
      <Modal visible={visible && !previewProfile} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
        <View style={local.root}>
          <StatusBar style={colors.statusBar} />
          <View style={[local.header, { paddingTop: Math.max(insets.top, 12) }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Wróć" onPress={onClose} style={local.back}><MaterialCommunityIcons name="chevron-left" size={24} color={colors.ink} /></Pressable>
            <View style={styles.fill}><Text style={local.title}>Zablokowane osoby</Text><Text style={local.subtitle}>Zarządzaj bezpieczeństwem i widocznością profili.</Text></View>
            <Text style={local.count}>{blockedProfileKeys.length}</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[local.content, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={local.intro}><MaterialCommunityIcons name="shield-lock-outline" size={22} color="#ff8298" /><Text style={local.introText}>Zablokowane osoby nie widzą Twojego profilu i nie mogą wysyłać Ci wiadomości. Nadal możesz je zgłosić.</Text></View>
            {loading ? (
              <View style={local.empty}><ActivityIndicator color={colors.primary} size="large" /><Text style={local.emptyText}>Pobieramy listę zablokowanych osób.</Text></View>
            ) : entries.length === 0 ? (
              <View style={local.empty}><View style={local.emptyIcon}><MaterialCommunityIcons name="shield-check" size={31} color={colors.green} /></View><Text style={local.emptyTitle}>Lista jest pusta</Text><Text style={local.emptyText}>Nie masz obecnie zablokowanych osób.</Text></View>
            ) : entries.map((entry) => {
              const displayName = entry.profile ? [entry.profile.name, entry.profile.surname].filter(Boolean).join(" ") : "Profil niedostępny";
              return (
                <View key={entry.key} style={local.item}>
                  <Pressable accessibilityRole="button" disabled={!entry.profile} onPress={() => entry.profile && setPreviewProfile(entry.profile)} style={local.itemTop}>
                    {entry.profile ? <Image source={entry.profile.image} style={local.avatar} contentFit="cover" /> : <View style={local.avatarFallback}><MaterialCommunityIcons name="account-off" size={24} color="#ff8298" /></View>}
                    <View style={styles.fill}><Text style={local.name} numberOfLines={1}>{displayName}</Text><Text style={local.meta}>{entry.profile ? [entry.profile.city, entry.profile.age + " lat"].filter(Boolean).join(" · ") : "Konto usunięte lub ukryte"}</Text></View>
                    <View style={local.badge}><MaterialCommunityIcons name="cancel" size={11} color="#ff8298" /><Text style={local.badgeText}>Zablokowany</Text></View>
                  </Pressable>
                  <View style={local.actions}>
                    <Pressable accessibilityRole="button" onPress={() => report(entry)} style={local.action}><MaterialCommunityIcons name="alert-outline" size={16} color={colors.primaryDeep} /><Text style={local.actionText}>Zgłoś</Text></Pressable>
                    <Pressable accessibilityRole="button" disabled={busyKey === entry.key} onPress={() => confirmUnblock(entry)} style={[local.action, local.actionDanger]}>{busyKey === entry.key ? <ActivityIndicator size="small" color="#ff8298" /> : <MaterialCommunityIcons name="account-check-outline" size={16} color="#ff8298" />}<Text style={[local.actionText, local.actionDangerText]}>Odblokuj</Text></Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
      {previewProfile && (
        <ProfilePreviewSheet profile={previewProfile} viewerInterests={[]} onClose={() => setPreviewProfile(null)} canViewSocials={false} readOnly blocked />
      )}
    </>
  );
}

function LanguagePickerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const language = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zamknij" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 14 }}>
          <View style={{ alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: colors.fillStronger }} />
          <Text style={[styles.mxTitle, { fontSize: 28, lineHeight: 34 }]}>Język</Text>
          <View style={styles.mxGroup}>
            {languageOptions.map((option, index) => {
              const active = option.code === language;
              return (
                <React.Fragment key={option.code}>
                  {index > 0 && <View style={[styles.pfDivider, { marginLeft: 16 }]} />}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => { setLanguage(option.code); onClose(); }}
                    style={({ pressed }) => [styles.pfRow, pressed && { backgroundColor: colors.fill }]}
                  >
                    <Text style={[styles.pfRowLabel, styles.fill]}>{option.label}</Text>
                    {active ? <MaterialCommunityIcons name="check" size={20} color={colors.primary} /> : null}
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>
          <Text style={styles.stFooter}>Teksty, których jeszcze nie przetłumaczyliśmy, zobaczysz po polsku.</Text>
        </View>
      </View>
    </Modal>
  );
}

function SafetyCenter({
  userUid,
  canManageModeration,
  onBack,
  onDeleteAccount,
  blockedProfileKeys,
  onUnblock,
  onReport
}: {
  userUid: string;
  canManageModeration: boolean;
  onBack: () => void;
  onDeleteAccount: () => void;
  blockedProfileKeys: string[];
  onUnblock: (profileKey: string) => Promise<boolean>;
  onReport: (profileKey: string, reason?: string) => Promise<boolean>;
}) {
  const { colors, styles } = useAppTheme();
  const [blockedListOpen, setBlockedListOpen] = useState(false);
  const [notificationPreferencesOpen, setNotificationPreferencesOpen] = useState(false);
  const [moderationQueueOpen, setModerationQueueOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const language = useLanguage();

  const manageAdPrivacy = async () => {
    try {
      const opened = await openAdsPrivacyOptions();
      if (!opened) {
        Alert.alert("Prywatność reklam", "Dla Twojego regionu nie są wymagane dodatkowe ustawienia zgód reklamowych.");
      }
    } catch {
      Alert.alert("Prywatność reklam", "Nie udało się otworzyć ustawień. Sprawdź połączenie i spróbuj ponownie.");
    }
  };

  type Row = { icon: string; tint: string; label: string; value?: string; onPress: () => void; destructive?: boolean };
  const groups: Array<{ title: string; footer?: string; rows: Row[] }> = [
    {
      title: "Konto",
      rows: [
        { icon: "translate", tint: "#007aff", label: "Język", value: languageOptions.find((option) => option.code === language)?.label, onPress: () => setLanguageOpen(true) },
        { icon: "bell-outline", tint: "#ff3b30", label: "Powiadomienia", onPress: () => setNotificationPreferencesOpen(true) },
        { icon: "account-cancel-outline", tint: "#8e8e93", label: "Zablokowane osoby", value: blockedProfileKeys.length > 0 ? String(blockedProfileKeys.length) : "Brak", onPress: () => setBlockedListOpen(true) }
      ]
    },
    {
      title: "Prywatność",
      footer: "Profil możesz zgłosić lub zablokować z jego karty albo z rozmowy. Blokada od razu ukrywa profil i przerywa kontakt.",
      rows: [
        { icon: "shield-lock-outline", tint: "#0a84ff", label: "Polityka prywatności", onPress: () => openLegalDocument("Polityka prywatności", legalLinks.privacy, "EXPO_PUBLIC_PRIVACY_POLICY_URL") },
        { icon: "bullhorn-outline", tint: "#ff9500", label: "Zgody reklamowe", onPress: () => void manageAdPrivacy() }
      ]
    },
    {
      title: "Pomoc i informacje",
      rows: [
        { icon: "email-outline", tint: "#34c759", label: "Napisz do nas", onPress: () => openSupportEmail("Spark - pomoc i bezpieczeństwo") },
        { icon: "account-group-outline", tint: colors.primary, label: "Zasady społeczności", onPress: () => openLegalDocument("Zasady społeczności", legalLinks.community, "EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL") },
        { icon: "file-document-outline", tint: "#5e5ce6", label: "Regulamin", onPress: () => openLegalDocument("Regulamin", legalLinks.terms, "EXPO_PUBLIC_TERMS_URL") }
      ]
    },
    ...(canManageModeration ? [{
      title: "Moderacja",
      rows: [{ icon: "gavel", tint: "#af52de", label: "Panel moderacji", onPress: () => setModerationQueueOpen(true) }]
    }] : []),
    {
      title: "",
      footer: "Usunie konto, zdjęcia, profil, polubienia, matche i wiadomości. Minimalne dane bezpieczeństwa i rozliczeń mogą zostać zachowane zgodnie z polityką prywatności.",
      rows: [{ icon: "delete-outline", tint: "#ff3b30", label: "Usuń konto", onPress: onDeleteAccount, destructive: true }]
    }
  ];
  const appVersion = Constants.expoConfig?.version ?? "";

  return (
    <View style={styles.gapLg}>
      <View style={styles.stHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Wróć do profilu" onPress={onBack} hitSlop={8} style={styles.stBack}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primary} />
          <Text style={styles.stBackText}>Profil</Text>
        </Pressable>
      </View>
      <Text style={styles.mxTitle}>Ustawienia</Text>

      {groups.map((group) => (
        <View key={group.title || "danger"} style={styles.stGroupWrap}>
          {!!group.title && <Text style={styles.stGroupTitle}>{group.title}</Text>}
          <View style={styles.mxGroup}>
            {group.rows.map((row, index) => (
              <React.Fragment key={row.label}>
                {index > 0 && <View style={styles.pfDivider} />}
                <Pressable accessibilityRole="button" onPress={row.onPress} style={({ pressed }) => [styles.pfRow, pressed && { backgroundColor: colors.fill }]}>
                  <View style={[styles.pfRowIcon, { backgroundColor: row.tint }]}><MaterialCommunityIcons name={row.icon as any} size={17} color="#fff" /></View>
                  <Text style={[styles.pfRowLabel, styles.fill, row.destructive && { color: "#ff3b30" }]}>{row.label}</Text>
                  {row.value ? <Text style={styles.pfRowValue}>{row.value}</Text> : null}
                  {!row.destructive && <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />}
                </Pressable>
              </React.Fragment>
            ))}
          </View>
          {!!group.footer && <Text style={styles.stFooter}>{group.footer}</Text>}
        </View>
      ))}

      {!!appVersion && <Text style={styles.pfFootnote}>Spark {appVersion}</Text>}

      <BlockedProfilesModal visible={blockedListOpen} blockedProfileKeys={blockedProfileKeys} onClose={() => setBlockedListOpen(false)} onUnblock={onUnblock} onReport={onReport} />
      <NotificationPreferencesModal visible={notificationPreferencesOpen} uid={userUid} onClose={() => setNotificationPreferencesOpen(false)} />
      <LanguagePickerModal visible={languageOpen} onClose={() => setLanguageOpen(false)} />
      {canManageModeration && <ModerationQueueModal visible={moderationQueueOpen} onClose={() => setModerationQueueOpen(false)} />}
    </View>
  );
}
function TopBar({
  eyebrow,
  title,
  left,
  right,
  onLeftPress,
  onRightPress
}: {
  eyebrow: string;
  title: string;
  left: string;
  right: string;
  onLeftPress?: () => void;
  onRightPress?: () => void;
}) {
  const { styles } = useAppTheme();
  return (
    <View style={styles.topBar}>
      <IconButton label={left} onPress={onLeftPress} />
      <View style={styles.topBarTitleWrap}>
        <View style={styles.topBarEyebrowRow}>
          <Image source={headerLogoImage} style={styles.topBarLogo} contentFit="contain" />
          <Text style={styles.eyebrow} numberOfLines={1} selectable>{eyebrow}</Text>
        </View>
        <Text style={styles.screenTitle} numberOfLines={1} selectable>{title}</Text>
      </View>
      <IconButton label={right} onPress={onRightPress} />
    </View>
  );
}
function getIconName(label: string) {
  const iconMap: Record<string, string> = {
    "=": "menu",
    "<": "chevron-left",
    "+": "plus",
    "?": "help-circle-outline",
    km: "map-marker-distance",
    pro: "crown",
    on: "check-circle",
    off: "circle-outline",
    close: "close",
    heart: "heart",
    "star-four-points": "star-four-points"
  };

  return iconMap[label] ?? label;
}

function getIconAccessibilityLabel(label: string) {
  const labels: Record<string, string> = {
    "=": "Menu",
    "<": "Wstecz",
    "+": "Dodaj",
    "?": "Pomoc",
    "tune-variant": "Preferencje odkrywania",
    "message-text": "Wiadomo\u015bci",
    "shield-check": "Bezpiecze\u0144stwo"
  };
  return labels[label] ?? label;
}

function IconButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const { colors, styles } = useAppTheme();
  if (!onPress) {
    return (
      <View style={styles.iconButtonStatic}>
        <MaterialCommunityIcons name={getIconName(label) as any} size={22} color={colors.ink} />
      </View>
    );
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={getIconAccessibilityLabel(label)} hitSlop={8} onPress={onPress} style={styles.iconButton}>
      <MaterialCommunityIcons name={getIconName(label) as any} size={22} color={colors.ink} />
    </Pressable>
  );
}
function RoundAction({
  label,
  tone,
  large = false,
  locked = false,
  onPress
}: {
  label: string;
  tone: "light" | "primary";
  large?: boolean;
  locked?: boolean;
  onPress?: () => void;
}) {
  const { colors, styles } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.roundAction, large && styles.roundActionLarge, tone === "primary" && styles.roundActionPrimary, locked && styles.roundActionLocked]}
    >
      <MaterialCommunityIcons name={getIconName(label) as any} size={large ? 38 : 30} color={tone === "primary" ? "#fff" : colors.ink} />
      {locked && (
        <View style={styles.roundActionLockBadge}>
          <MaterialCommunityIcons name="lock" size={11} color={colors.ink} />
        </View>
      )}
    </Pressable>
  );
}
function SettingRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const { styles } = useAppTheme();
  return (
    <Pressable style={styles.settingRow} onPress={onPress}>
      <Text style={styles.settingLabel} selectable>{label}</Text>
      <Text style={styles.settingValue} selectable>{value}</Text>
    </Pressable>
  );
}

class SparkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    recordSparkError(error, "react_render", { component_stack: info.componentStack?.slice(0, 100) });
    if (__DEV__) {
      console.error("Spark render error", error, info.componentStack);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const styles = themedStyles.dark;

    return (
      <View style={styles.appErrorRoot}>
        <MaterialCommunityIcons name="alert-circle-outline" size={42} color="#ff2d8d" />
        <Text style={styles.appErrorTitle}>Coś poszło nie tak</Text>
        <Text style={styles.appErrorBody}>
          Uruchom Spark ponownie. Twoje konto i zapisane dane są bezpieczne.
        </Text>
        <Pressable style={styles.appErrorButton} onPress={() => this.setState({ hasError: false })}>
          <Text style={styles.appErrorButtonText}>Spróbuj ponownie</Text>
        </Pressable>
      </View>
    );
  }
}

/** Development only (web, `?preview=chat&theme=dark[&open=1]`): the chat list / a conversation with demo data. */
function DevChatPreview({ themeName, openFirst }: { themeName: string | null; openFirst: boolean }) {
  const { colors, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (themeName === "light" || themeName === "dark") theme.setPreference(themeName); }, [themeName]);
  const keys = matchProfiles.map(getProfileKey);
  const [selected, setSelected] = useState<string | null>(openFirst ? keys[0] : null);
  const threads: Record<string, ChatThread> = {
    [keys[0]]: { profileKey: keys[0], status: "matched", unreadCount: 0, messages: [
      { id: "1", from: "them", text: "Hej! Widzę, że też lubisz sztukę 🙂", time: "18:02" },
      { id: "2", from: "them", text: "Byłaś ostatnio na jakiejś wystawie?", time: "18:02" },
      { id: "3", from: "me", text: "Tak! W MOCAK-u, polecam bardzo", time: "18:05" },
      { id: "4", from: "them", text: "To może razem w weekend?", time: "18:06" }
    ] },
    [keys[1]]: { profileKey: keys[1], status: "matched", unreadCount: 2, lastMessageText: "Jutro koncert, idziesz?", lastMessageAtMs: Date.now() - 3600000, messages: [] },
    [keys[2]]: { profileKey: keys[2], status: "requested", requestDirection: "incoming", introMessage: "Cześć! Chcesz pogadać o planszówkach?", messages: [] }
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 40 }}>
      <MessagesScreen
        profiles={matchProfiles}
        matchedProfileKeys={keys.slice(0, 2)}
        chatRequestKeys={[keys[2]]}
        chatThreads={threads}
        selectedChatKey={selected}
        setSelectedChatKey={setSelected}
        pendingMessageDraft={null}
        onPendingMessageDraftConsumed={() => undefined}
        onSendMessage={async () => true}
        onAcceptRequest={() => undefined}
        onRejectRequest={() => undefined}
        onBlockProfile={() => undefined}
        onReportProfile={() => undefined}
        viewerInterests={["Sztuka"]}
        viewerIntents={["Randki", "Znajomi"]}
        showChatListAd={false}
      />
    </ScrollView>
  );
}

/** Development only (web, `?preview=settings&theme=dark`). */
function DevSettingsPreview({ themeName }: { themeName: string | null }) {
  const { colors, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (themeName === "light" || themeName === "dark") theme.setPreference(themeName); }, [themeName]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 40 }}>
      <SafetyCenter userUid="" canManageModeration onBack={() => undefined} onDeleteAccount={() => undefined} blockedProfileKeys={["a"]} onUnblock={async () => true} onReport={async () => true} />
    </ScrollView>
  );
}

/** Development only (web, `?preview=profile&theme=dark`): the Profile screen with demo data. */
function DevProfilePreview({ themeName }: { themeName: string | null }) {
  const { colors, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (themeName === "light" || themeName === "dark") theme.setPreference(themeName); }, [themeName]);
  const demo = matchProfiles[1];
  const [filters, setFilters] = useState(createDefaultDiscoverFilters());
  const [socials, setSocials] = useState<SocialHandles>({ instagram: "", tiktok: "", facebook: "" });
  const noop = () => undefined;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 40 }}>
      <ProfileScreen
        firstName={demo.name} setFirstName={noop} lastName="" setLastName={noop}
        profileNameMode="realName" setProfileNameMode={noop} nickname="" setNickname={noop}
        gender="woman" setGender={noop} birthDate="2000-05-01" intents={["Randki", "Znajomi"]} setIntents={noop}
        profileBio={demo.bio} setProfileBio={noop} onBirthDateChange={noop}
        discoverFilters={filters} setDiscoverFilters={setFilters}
        userCity="Kraków" userCountry="Polska" locationStatus="granted" locationBusy={false} onRequestLocation={noop}
        activeEvents={[]} onManageEvents={noop} onOpenEventFeed={noop} onLeaveEvent={async () => true}
        email="demo@spark.app" selectedInterests={demo.interests} setSelectedInterests={noop}
        userAge={demo.age} setUserAge={noop} profilePhotos={[demo.image as ProfilePhoto]} setProfilePhotos={noop}
        profileName={demo.name} socialHandles={socials} setSocialHandles={setSocials}
        premiumPlan="monthly" hasPro={false} profileViewers={[]} profileViewerCount={0} profileViewersLoading={false}
        openPremium={noop} openCustomerCenter={async () => ({ ok: true })} openSafety={noop}
        onSave={async () => true} onSignOut={noop} onInvite={noop} verificationStatus="verified"
        lgbt={null} lgbtBusy={false} onChangeLgbt={noop}
      />
    </ScrollView>
  );
}

/** Development only (web, `?preview=matches&theme=dark`): the Matches screen with demo data. */
function DevMatchesPreview({ themeName }: { themeName: string | null }) {
  const { colors, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (themeName === "light" || themeName === "dark") theme.setPreference(themeName); }, [themeName]);
  const keys = matchProfiles.map(getProfileKey);
  const noop = async () => undefined;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 40 }}>
      <MatchesScreen
        profiles={matchProfiles}
        matchedProfileKeys={keys.slice(0, 2)}
        likedProfileKeys={keys.slice(2, 4)}
        incomingLikeKinds={{ [keys[3]]: "like" }}
        chatRequestKeys={[]}
        chatThreads={{}}
        hasPro
        viewerInterests={[]}
        viewerIntents={["Randki", "Znajomi"]}
        onLikeIncomingProfile={noop}
        onCancelPendingLike={noop}
        onSuperlikePendingProfile={noop}
        onCancelRequest={noop}
        onOpenMessages={() => undefined}
        onOpenConversation={() => undefined}
      />
    </ScrollView>
  );
}

/**
 * Development only (web, `?preview=discover&theme=light`): the Discover screen
 * with bundled demo profiles, without signing in to production.
 */
function DevPreview({ themeName }: { themeName: string | null }) {
  const { colors, styles, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<DeckMode>("romantic");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (themeName === "light" || themeName === "dark") theme.setPreference(themeName); }, [themeName]);
  const deck = matchProfiles.map((profile, position) => ({ ...profile, distance: `${2 + position * 3} km` }));
  const profile = deck[index % deck.length];
  const next = deck[(index + 1) % deck.length];
  const filters = createDefaultDiscoverFilters();
  const screenMinHeight = Math.max(520, height - Math.max(insets.top + 4, 12) - Math.max(insets.bottom + 94, 106) + 8);
  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.root}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={[styles.scroll, styles.discoverScroll, { paddingTop: Math.max(insets.top + 4, 12), paddingBottom: Math.max(insets.bottom + 94, 106), paddingHorizontal: 16 }]}>
        <DiscoverScreen
          modeSwitch={<ModeSwitch mode={previewMode} onChange={setPreviewMode} />}
          deckMode={previewMode}
          mode={previewMode === "event" ? "events" : "people"}
          feedExpansionLevel={0}
          activeEvents={[]}
          profile={profile}
          nextProfile={next}
          hasPro={false}
          onSwipe={async () => { setIndex((value) => value + 1); return "liked"; }}
          onPremiumChatRequest={() => undefined}
          onOpenMessages={() => undefined}
          messageNotificationCount={1}
          onOpenMatches={() => undefined}
          onOpenProfile={() => undefined}
          onOpenPremium={() => undefined}
          onOpenSafety={() => undefined}
          onSignOut={() => undefined}
          onInvite={() => undefined}
          hasMatchedProfile={false}
          hasRequestedProfile={false}
          superlikesRemaining={10}
          selectedInterests={["Gaming", "Planszówki", "Muzyka"]}
          discoverFilters={filters}
          screenMinHeight={screenMinHeight}
          onReportProfile={async () => true}
          onRefresh={() => setIndex(0)}
          onSavePreferences={async () => true}
          onOpenEventFriends={() => undefined}
          onBackToPeople={() => undefined}
          onManageEvents={() => undefined}
        />
      </ScrollView>
    </LinearGradient>
  );
}

function DevEventPreview({ themeName }: { themeName: string | null }) {
  const theme = useThemeState();
  const [open, setOpen] = useState(true);
  const previewCity = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("city") ?? "Warszawa" : "Warszawa";
  const [events, setEvents] = useState<SparkEvent[]>(() => {
    const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const make = (id: string, name: string, city: string, category: EventCategoryId, icon: EventIconId): SparkEvent => ({ id, name, city, category, icon, kind: "specific", date: start.toISOString().slice(0, 10), startsAt: start.toISOString(), endsAt: end.toISOString() });
    return [
      make("dev-mata", "Koncert Maty", "Warszawa", "music", "microphone-variant"),
      make("dev-kino", "Maraton filmowy", "Kraków", "cinema", "movie-open-outline"),
      make("dev-plansz", "Planszówki w Hali Koszyki", "Warszawa", "games", "dice-multiple"),
      make("dev-mecz", "Lech – Legia", "Poznań", "sport", "soccer"),
      make("dev-nyc-show", "Brooklyn Rooftop Show", "New York", "music", "music-note"),
      make("dev-nyc-game", "Knicks Watch Party", "New York", "sport", "stadium-outline"),
      make("dev-la-film", "Hollywood Movie Night", "Los Angeles", "cinema", "popcorn")
    ];
  });
  const previewCountryCode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("country") ?? "PL" : "PL";
  const previewDetails: Record<string, EventDetails> = { "dev-nyc-show": { countryCode: "US", venue: "Williamsburg" }, "dev-nyc-game": { countryCode: "US" }, "dev-la-film": { countryCode: "US" } };
  const [selected, setSelected] = useState<SparkEvent[]>([]);
  const [proposals, setProposals] = useState<EventProposal[]>([]);
  const failNextSave = useRef(typeof window !== "undefined" && new URLSearchParams(window.location.search).has("failOnce"));
  useEffect(() => { if (themeName === "light" || themeName === "dark") theme.setPreference(themeName); }, [themeName]);
  return <View style={{ flex: 1, backgroundColor: theme.palette.background, paddingTop: 40 }}>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ minHeight: 48, padding: 16 }}><Text style={{ color: theme.palette.ink }}>Otwórz wydarzenia</Text></Pressable>
    <EventFriendsManagerModal visible={open} events={selected} availableEvents={events} userCity={previewCity} userCountry={previewCountryCode === "US" ? "United States" : "Polska"} userCountryCode={previewCountryCode} expiredCount={0} canManage={false} catalogLoading={false} catalogError={null} eventDetails={previewDetails} proposals={proposals} proposalsLoading={false} proposalsError={null} onReloadCatalog={() => undefined} onReloadProposals={() => undefined} onClose={() => setOpen(false)} onSave={async (next) => { setSelected(next); return true; }} onCreate={async (event) => { setEvents((current) => [...current, event]); return true; }} onDelete={async (event) => { setEvents((current) => current.filter((item) => item.id !== event.id)); return true; }} onPropose={async (event, details) => {
      if (failNextSave.current) { failNextSave.current = false; return false; }
      setProposals((current) => [...current, { id: event.id, event, details, status: "pending", createdByUid: "preview", createdAtMs: Date.now(), reviewedAtMs: null }]);
      return true;
    }} onWithdrawProposal={async (proposal) => { setProposals((current) => current.filter((item) => item.id !== proposal.id)); return true; }} onReviewProposal={async () => false} />
  </View>;
}

export default function App() {
  const params = __DEV__ && Platform.OS === "web" && typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const previewLanguage = params?.get("lang");
  if (previewLanguage && languageOptions.some((option) => option.code === previewLanguage)) setLanguage(previewLanguage as Parameters<typeof setLanguage>[0]);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SparkErrorBoundary>
          {params?.get("preview") === "discover" ? <DevPreview themeName={params.get("theme")} /> : params?.get("preview") === "events" ? <DevEventPreview themeName={params.get("theme")} /> : params?.get("preview") === "matches" ? <DevMatchesPreview themeName={params.get("theme")} /> : params?.get("preview") === "settings" ? <DevSettingsPreview themeName={params.get("theme")} /> : params?.get("preview") === "profile" ? <DevProfilePreview themeName={params.get("theme")} /> : params?.get("preview") === "chat" ? <DevChatPreview themeName={params.get("theme")} openFirst={params.get("open") === "1"} /> : <AppContent />}
        </SparkErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
  appErrorRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#050306"
  },
  appErrorTitle: {
    marginTop: 18,
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center"
  },
  appErrorBody: {
    maxWidth: 360,
    marginTop: 10,
    color: "#bdb6bf",
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center"
  },
  appErrorButton: {
    minWidth: 220,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#ff2d8d"
  },
  appErrorButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  authRestore: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center"
  },
  root: {
    flex: 1,
    overflow: "hidden"
  },
  animatedBackground: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#020203"
  },
  backgroundRoseWash: {
    position: "absolute",
    left: -70,
    right: -70,
    top: -110,
    height: 360,
    borderRadius: 140,
    backgroundColor: "rgba(255,45,141,0.34)",
    transform: [{ rotate: "-10deg" }],
    boxShadow: "0 0 120px rgba(255,45,141,0.46)"
  },
  backgroundRoseSweep: {
    position: "absolute",
    left: -120,
    right: -120,
    top: 145,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(255,45,141,0.5)",
    boxShadow: "0 0 90px rgba(255,45,141,0.5)"
  },
  backgroundRoseHorizon: {
    position: "absolute",
    left: -40,
    right: -40,
    bottom: -90,
    height: 230,
    borderRadius: 110,
    backgroundColor: "rgba(255,45,141,0.2)",
    boxShadow: "0 0 120px rgba(255,45,141,0.32)"
  },
  scroll: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    flexGrow: 1,
    gap: 18
  },
  discoverScroll: {
    gap: 0
  },
  fill: {
    flex: 1
  },
  gapLg: {
    gap: 15
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
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.28)",
    boxShadow: "0 24px 58px rgba(255,45,141,0.34)"
  },
  logoImage: {
    width: "100%",
    height: "100%"
  },
  loginLogoImage: {
    width: 188,
    height: 96
  },
  loginLogoMark: {
    width: 200,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
    overflow: "visible",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    boxShadow: "none",
    transform: [{ rotate: "-1deg" }]
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  sparkTitleWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 76,
    paddingHorizontal: 20,
    overflow: "hidden"
  },
  sparkTitle: {
    color: colors.ink,
    fontFamily: "Arial Rounded MT Bold",
    fontSize: 62,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 70,
    transform: [{ skewX: "-8deg" }],
    textShadowColor: "rgba(255,255,255,0.36)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14
  },
  sparkTitleGlow: {
    position: "absolute",
    color: colors.primary,
    fontFamily: "Arial Rounded MT Bold",
    fontSize: 62,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 70,
    transform: [{ skewX: "-8deg" }],
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30
  },
  sparkTitlePink: {
    position: "absolute",
    color: colors.primaryDeep,
    fontFamily: "Arial Rounded MT Bold",
    fontSize: 62,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 70,
    transform: [{ translateX: 2 }, { translateY: 2 }, { skewX: "-8deg" }],
    textShadowColor: "rgba(255,45,141,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18
  },
  sparkTitleShimmer: {
    position: "absolute",
    width: 26,
    height: 78,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    boxShadow: "0 0 22px rgba(255,255,255,0.72)"
  },
  lead: {
    maxWidth: 330,
    color: colors.inkSoft,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  brandCompact: {
    alignItems: "center",
    gap: 2,
    paddingTop: 0
  },
  authShell: { width: "100%", maxWidth: 520, alignSelf: "center", gap: 18 },
  authHero: { alignItems: "center", gap: 5, paddingTop: 4, paddingBottom: 2 },
  authEyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  authTitle: { color: colors.ink, fontSize: 30, lineHeight: 35, textAlign: "center", fontWeight: "900" },
  authSubtitle: { maxWidth: 340, color: colors.inkSoft, fontSize: 14, lineHeight: 20, textAlign: "center", fontWeight: "600" },
  authDivider: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10 },
  authDividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.09)" },
  authDividerText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  feedProfilePressable: { flex: 1, minHeight: 0 },
  screenHeroTitle: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39,
    textAlign: "center",
    letterSpacing: 0
  },
  formCard: {
    gap: 12,
    padding: 15,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  nameRow: {
    flexDirection: "row",
    gap: 10
  },
  fieldGroup: {
    flex: 1,
    gap: 7
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  fieldInputWrap: {
    position: "relative"
  },
  fieldInput: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700"
  },
  profileBioHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  profileBioCounter: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  profileBioInput: {
    minHeight: 118,
    paddingTop: 14,
    paddingBottom: 14,
    lineHeight: 21
  },
  profileBioHint: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700"
  },
  fieldInputWithIcon: {
    paddingRight: 52
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill
  },
  legalConsent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 2
  },
  legalCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: colors.fill
  },
  legalCheckboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  legalConsentCopy: { flex: 1, gap: 3 },
  legalConsentText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  legalLinkRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  legalLink: { color: colors.primaryDeep, fontSize: 12, lineHeight: 17, fontWeight: "900" },
  socialLoginGrid: {
    flexDirection: "column",
    gap: 10
  },
  appleLoginButton: {
    width: "100%",
    height: 50
  },
  socialLoginButton: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  socialLoginText: {
    color: colors.ink,
    fontWeight: "900"
  },
  forgotPasswordButton: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  forgotPasswordText: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: "800"
  },
  authBackToLoginButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.34)",
    backgroundColor: "rgba(255,45,141,0.08)"
  },
  authBackToLoginText: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: "900"
  },
  socialLoginButtonDisabled: {
    opacity: 0.48
  },
  configWarning: {
    gap: 6,
    padding: 14,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,45,141,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  configWarningTitle: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: "900"
  },
  configWarningText: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18
  },
  panel: {
    gap: 12,
    padding: 16,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  panelLiquid: {
    gap: 12,
    padding: 16,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.22)",
    boxShadow: `0 20px 48px ${colors.shadow}`
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  panelText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9
  },
  chip: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: "0 10px 22px rgba(99,51,61,0.06)"
  },
  chipActive: {
    boxShadow: "0 14px 30px rgba(99,51,61,0.14)"
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 999
  },
  chipText: {
    fontSize: 13,
    fontWeight: "900"
  },
  ageRangeGrid: { flexDirection: "row", gap: 10 },
  ageRangeSide: { flex: 1, gap: 7 },
  ageRangeButtons: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    backgroundColor: colors.fill
  },
  ageRangeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  ageRangeValue: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  setupSection: {
    gap: 13,
    padding: 16,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
  },
  setupSectionHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  setupIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  segmentedChoice: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 16,
    backgroundColor: colors.fill
  },
  segmentedChoiceItem: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13
  },
  segmentedChoiceItemActive: { backgroundColor: colors.primary },
  segmentedChoiceText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  segmentedChoiceTextActive: { color: "#fff" },
  themeSettingRow: { gap: 10, paddingVertical: 12, paddingHorizontal: 4 },
  setupHelper: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  locationControl: { gap: 8, marginTop: 4 },
  locationStatus: { flexDirection: "row", alignItems: "center", gap: 7 },
  locationStatusText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  locationAction: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.fill, borderWidth: 1, borderColor: colors.fillStrong },
  locationActionText: { color: colors.ink, fontSize: 13, fontWeight: "900", textAlign: "center" },
  locationPrivacyText: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  onboardingPhotoGrid: { flexDirection: "row", gap: 10 },
  onboardingPhotoSlot: {
    flex: 1,
    aspectRatio: 0.8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)"
  },
  settingHint: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 15 },
  intentList: {
    gap: 12
  },
  intentListCompact: {
    gap: 8
  },
  intentCard: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)",
    backgroundColor: colors.card,
    boxShadow: "0 14px 34px rgba(99,51,61,0.07)"
  },
  intentCardCompact: {
    minHeight: 58,
    paddingVertical: 9
  },
  intentCardActive: {
    borderColor: "rgba(255,45,141,0.32)",
    backgroundColor: colors.cardTinted
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
  intentIconRainbow: {
    backgroundColor: "transparent"
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)"
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  noticeText: {
    marginTop: 4,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 19
  },
  agePanel: {
    gap: 12,
    padding: 16,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.22)",
    boxShadow: `0 18px 42px ${colors.shadow}`
  },
  ageChoiceRow: {
    flexDirection: "row",
    gap: 10
  },
  ageChoice: {
    flex: 1,
    minHeight: 92,
    gap: 6,
    padding: 13,
    borderRadius: 22,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(145,110,111,0.14)",
    backgroundColor: colors.card
  },
  ageChoiceActive: {
    borderColor: "rgba(255,45,141,0.34)",
    backgroundColor: "rgba(255,45,141,0.2)"
  },
  ageChoiceDisabled: {
    opacity: 0.45
  },
  ageChoiceTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  ageChoiceTitleActive: {
    color: colors.primaryDeep
  },
  ageChoiceText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  ageWarning: {
    color: colors.primaryDeep,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "900"
  },
  primaryButton: {
    minHeight: 58,
    flexDirection: "row",
    gap: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    boxShadow: "0 18px 44px rgba(255,45,141,0.32)"
  },
  primaryButtonDisabled: {
    backgroundColor: "rgba(255,45,141,0.42)",
    boxShadow: "0 8px 20px rgba(255,45,141,0.14)"
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900"
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
  },
  secondaryButtonWide: {
    minHeight: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
  },
  secondaryButtonText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: "900"
  },
  purchasePanel: {
    gap: 12,
    padding: 16,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  purchaseActionsRow: {
    flexDirection: "row",
    gap: 10
  },
  purchaseHint: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18
  },
  revenueCatError: {
    color: colors.primaryDeep,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800"
  },
  discoverScreen: { flex: 1, minHeight: 0, width: "100%", gap: 10, paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0, overflow: "hidden" },
  deckArea: { flex: 1, minHeight: 380, marginTop: 10, position: "relative" },
  sponsoredLayer: { zIndex: 20, alignItems: "stretch", justifyContent: "center" },
  sponsoredHidden: { opacity: 0 },
  sponsoredCard: { flex: 1, overflow: "hidden", alignItems: "center", justifyContent: "center", gap: 14, padding: 18, borderRadius: 28, borderWidth: 1, borderColor: colors.glassBorder },
  sponsoredHeader: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sponsoredEyebrow: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  sponsoredUpgrade: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  sponsoredSlot: { minHeight: 250, alignItems: "center", justifyContent: "center" },
  sponsoredText: { color: colors.muted, fontSize: 12, fontWeight: "600", textAlign: "center" },
  sponsoredNext: { alignSelf: "stretch", minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 25, backgroundColor: colors.primary },
  sponsoredNextText: { color: colors.onPrimary, fontSize: 15, fontWeight: "800" },
  deckLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  // The glass action bar floats inside the bottom of the card.
  deckActionDock: { position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 20 },
  discoverEmptyScreen: {
    gap: 14
  },
  discoverEmptyBody: {
    flex: 1,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 42
  },
  discoverEmptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,45,141,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)"
  },
  discoverEmptyTitle: {
    color: colors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900"
  },
  discoverEmptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  },
  discoverEmptyStat: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: "rgba(255,45,141,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)"
  },
  discoverEmptyStatText: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800"
  },
  stitchTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  reportIconButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef2449",
    borderWidth: 1,
    borderColor: colors.fillStronger,
    boxShadow: "0 0 22px rgba(239,36,73,0.42)"
  },
  discoverTitleBlock: {
    gap: 1
  },
  discoverEyebrow: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  discoverTitle: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900"
  },
  locationGlassPill: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  locationGlassText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  stitchPlanToggle: {
    display: "none"
  },
  discoverSummaryBar: {
    minHeight: 40,
    marginHorizontal: 0,
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  discoverSummaryPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6
  },
  discoverSummaryPillDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.fillStrong
  },
  discoverSummaryText: {
    minWidth: 0,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900"
  },
  feedExpansionNotice: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, borderRadius: 16, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  feedExpansionNoticeText: { flex: 1, color: colors.inkSoft, fontSize: 11, lineHeight: 14, fontWeight: "600" },
  eventFriendsLaunch: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 22, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  eventFriendsLaunchActive: { borderColor: colors.event },
  eventFriendsLaunchParty: { backgroundColor: colors.glassStrong, borderColor: colors.event },
  eventFriendsLaunchPartyIcon: { backgroundColor: colors.event },
  eventFriendsLaunchPartyEyebrow: { color: colors.event },
  eventFriendsLaunchIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.event },
  eventFriendsLaunchEyebrow: { color: colors.muted, fontSize: 9, lineHeight: 11, fontWeight: "700", letterSpacing: 0.5 },
  eventFriendsLaunchTitle: { marginTop: 1, color: colors.ink, fontSize: 14, lineHeight: 17, fontWeight: "700" },
  eventFriendsLaunchCount: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 999, color: colors.onPrimary, backgroundColor: colors.event, textAlign: "center", textAlignVertical: "center", fontSize: 11, lineHeight: 24, fontWeight: "800" },
  stitchPlanButtonActive: {
    backgroundColor: colors.primary,
    boxShadow: "0 0 28px rgba(255,76,131,0.28)"
  },
  stitchPlanText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "900"
  },
  stitchPlanTextActive: {
    color: "#fff"
  },
  stitchMainCanvas: {
    position: "relative",
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  feedCardDeck: {
    position: "relative",
    flexShrink: 1,
    alignSelf: "center"
  },
  swipeCardMotion: {
    width: "100%",
    height: "100%",
    zIndex: 2
  },
  nextProfileCard: {
    position: "absolute",
    top: 7,
    left: 7,
    right: 7,
    bottom: 7,
    zIndex: 1,
    opacity: 0.36,
    transform: [{ scale: 0.975 }]
  },
  swipeCue: {
    position: "absolute",
    top: 36,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.scrim,
    zIndex: 20
  },
  swipeCueLeft: {
    left: 24,
    transform: [{ rotate: "-12deg" }]
  },
  swipeCueRight: {
    right: 24,
    transform: [{ rotate: "12deg" }]
  },
  swipeCueLike: {
    borderColor: colors.green,
    backgroundColor: colors.card
  },
  swipeCueText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.2
  },
  swipeCueTextLike: {
    color: colors.green
  },

  swipeFeedback: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    zIndex: 30,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,45,141,0.94)",
    boxShadow: "0 12px 28px rgba(255,45,141,0.34)"
  },
  swipeFeedbackText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  stitchBottomPanel: {
    marginTop: 0,
    minHeight: 72,
    paddingTop: 3,
    paddingBottom: 2
  },
  stitchFabDock: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 10
  },
  stitchProHintRow: {
    minHeight: 38,
    marginTop: 8,
    marginHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  stitchProHintText: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800"
  },
  stitchSafetyDock: {
    display: "none"
  },
  stitchSafetyButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  stitchSafetyText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: "900"
  },
  swipeFabButton: {
    width: 78,
    alignItems: "center",
    gap: 3
  },
  swipeFabIcon: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.fillStrong,
    boxShadow: `0 14px 30px ${colors.shadow}`
  },
  swipeFabIconSmall: {
    width: 42,
    height: 42
  },
  swipeFabIconLarge: {
    width: 58,
    height: 58
  },
  swipeFabIconPrimary: {
    backgroundColor: colors.primary,
    boxShadow: "0 0 32px rgba(255,76,131,0.46)"
  },
  swipeFabLock: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 21,
    height: 21,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceStrong,
    borderWidth: 2,
    borderColor: colors.background
  },
  swipeFabLabel: {
    maxWidth: 70,
    color: colors.ink,
    fontSize: 8,
    lineHeight: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    textAlign: "center",
    fontWeight: "900"
  },
  swipeFabLabelPrimary: {
    color: colors.primary,
    letterSpacing: 1
  },
  swipeFabSublabel: {
    maxWidth: 62,
    marginTop: -2,
    color: colors.muted,
    fontSize: 8,
    lineHeight: 10,
    textAlign: "center",
    fontWeight: "800"
  },
  controlPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.985 }]
  },
  discoveryModalRoot: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "transparent"
  },
  discoveryModalBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim
  },
  discoveryDrawer: {
    width: "86%",
    maxWidth: 370,
    height: "100%",
    zIndex: 2,
    paddingHorizontal: 18,
    backgroundColor: "#0b0a0f",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,45,141,0.2)",
    boxShadow: `18px 0 54px ${colors.shadow}`
  },
  discoveryDrawerScrollView: {
    flex: 1
  },
  discoveryDrawerScroll: {
    flexGrow: 1,
    paddingBottom: 2
  },
  discoveryDrawerSpacer: {
    flexGrow: 1,
    minHeight: 12
  },
  discoveryDrawerHeader: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18
  },
  discoveryDrawerBrand: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  discoveryDrawerLogo: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255,45,141,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.24)"
  },
  discoveryDrawerLogoImage: {
    width: 40,
    height: 20
  },
  discoveryDrawerEyebrow: {
    color: colors.primary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900"
  },
  discoveryDrawerTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900"
  },
  discoveryDrawerClose: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  discoveryDrawerNav: {
    gap: 5
  },
  discoveryMenuRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 10,
    borderRadius: 18
  },
  discoveryMenuRowActive: {
    backgroundColor: "rgba(255,45,141,0.11)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)"
  },
  discoveryMenuIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.055)"
  },
  discoveryMenuIconActive: {
    backgroundColor: colors.primary
  },
  discoveryMenuLabel: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  discoveryMenuLabelActive: {
    color: "#fff"
  },
  discoveryMenuHint: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700"
  },
  discoveryMenuBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  discoveryMenuBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900"
  },
  discoveryMenuActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  discoveryDrawerDivider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: colors.fillStrong
  },
  discoveryMenuUtility: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    borderRadius: 16
  },
  discoveryFilterCount: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  discoveryFilterCountText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900"
  },
  discoverySafetyRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(76,208,142,0.07)",
    borderWidth: 1,
    borderColor: "rgba(76,208,142,0.14)"
  },
  discoverySafetyIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "rgba(76,208,142,0.1)"
  },
  discoveryFilterModalRoot: {
    alignItems: "stretch",
    justifyContent: "flex-end"
  },
  discoveryFilterSheet: {
    width: "100%",
    maxHeight: "93%",
    zIndex: 2,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#0c0b11",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)",
    boxShadow: `0 -20px 54px ${colors.shadow}`
  },
  discoverySheetHandle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    marginBottom: 11,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  discoveryFilterHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 2,
    paddingBottom: 14
  },
  discoveryFilterEyebrow: {
    color: colors.primary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900"
  },
  discoveryFilterTitle: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900"
  },
  discoveryFilterSubtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  discoveryFilterScroll: {
    gap: 4,
    paddingBottom: 14
  },
  discoveryFilterSection: {
    gap: 12,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.075)"
  },
  discoveryFilterSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  discoveryFilterSectionIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,45,141,0.1)"
  },
  discoveryFilterSectionTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  discoveryFilterSectionHint: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700"
  },
  discoveryDistanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  discoveryDistanceOption: {
    minWidth: 82,
    minHeight: 42,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  discoveryDistanceOptionActive: {
    backgroundColor: "rgba(255,45,141,0.16)",
    borderColor: colors.primary
  },
  discoveryDistanceText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  discoveryDistanceTextActive: {
    color: "#fff"
  },
  discoveryFilterToggleRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.045)"
  },
  discoveryFilterToggleTitle: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  discoveryFilterToggleHint: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700"
  },
  discoveryFilterFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.fillStrong
  },
  discoveryResetButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 15,
    borderRadius: 17,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)"
  },
  discoveryResetText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  discoveryApplyButton: {
    minHeight: 52,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 17,
    backgroundColor: colors.primary,
    boxShadow: "0 14px 32px rgba(255,45,141,0.27)"
  },
  discoveryApplyText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },  reportOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 60,
    justifyContent: "flex-end"
  },
  reportBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim
  },
  reportSheet: {
    gap: 14,
    padding: 18,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)"
  },
  reportSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  reportTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900"
  },
  reportSubtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800"
  },
  reportCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill
  },
  reportInput: {
    minHeight: 126,
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    color: colors.ink,
    backgroundColor: colors.scrim,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  reportSendButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    boxShadow: "0 16px 34px rgba(255,45,141,0.26)"
  },
  reportSendText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900"
  },
  monetizationStatus: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.12)"
  },
  monetizationStatusText: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800"
  },
  topBar: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4
  },
  topBarTitleWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
    minWidth: 0
  },
  topBarEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  topBarLogo: {
    width: 36,
    height: 18
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.28)",
    boxShadow: "0 10px 24px rgba(255,45,141,0.1)"
  },
  iconButtonStatic: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.72
  },
  iconButtonText: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "700"
  },
  screenTitle: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: 0
  },
  segmented: {
    flexDirection: "row",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: colors.surfaceStrong,
    boxShadow: `0 12px 30px ${colors.shadow}`
  },
  segmentText: {
    color: colors.muted,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: colors.primaryDeep
  },
  profileCard: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "#151017",
    borderWidth: 1,
    borderColor: colors.fill,
    boxShadow: `0 24px 64px ${colors.shadow}`
  },
  profileCardCompact: {
    minHeight: 0
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
    top: 22,
    left: 20,
    right: 74,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    zIndex: 5
  },
  badge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    color: colors.ink,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    fontSize: 11,
    fontWeight: "900"
  },
  cardContextRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4
  },
  cardContextText: {
    flexShrink: 1,
    minWidth: 0,
    color: colors.inkSoft,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5
  },
  cardContextDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.58)"
  },
  featuredInterestRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 5,
    marginTop: 7,
    marginBottom: 2
  },
  featuredInterestPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1
  },
  featuredInterestText: {
    flexShrink: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900"
  },
  cardAffinityInsight: {
    minHeight: 27,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: "rgba(91,45,142,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,154,200,0.3)"
  },
  cardAffinityInsightText: {
    flex: 1,
    minWidth: 0,
    color: "#ffe3ef",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900"
  },
  cardReportButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 42,
    height: 42,
    zIndex: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,36,73,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    boxShadow: "0 0 24px rgba(239,36,73,0.42)"
  },
  cardSparkOverlay: {
    position: "absolute",
    top: "31%",
    left: 24,
    width: 132,
    height: 84,
    opacity: 0.72,
    zIndex: 4
  },
  profileCopy: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 5
  },
  profileCopyCompact: {
    bottom: 16
  },
  profileCardEvent: {
    borderColor: "rgba(178,114,255,0.52)",
    boxShadow: "0 16px 36px rgba(135,61,255,0.16)"
  },
  cardSharedEvent: {
    alignSelf: "stretch",
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 7,
    paddingHorizontal: 9,
    borderRadius: 11,
    backgroundColor: "rgba(255,45,141,0.84)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)"
  },
  cardSharedEventText: {
    flex: 1,
    minWidth: 0,
    color: "#fff",
    fontSize: 10,
    fontWeight: "900"
  },
  cardSharedEventDate: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 9,
    fontWeight: "800"
  },
  profileStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6
  },
  cardProBadge: {
    alignSelf: "flex-start",
    minHeight: 29,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)"
  },
  cardProText: {
    color: "#3a2500",
    fontSize: 10,
    fontWeight: "900"
  },
  cardVerifiedBadge: {
    minHeight: 29,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(72,187,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(99,215,255,0.38)"
  },
  cardVerifiedText: { color: "#63d7ff", fontSize: 9, fontWeight: "900" },
  cardTitle: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 30,
    textShadowColor: "rgba(0,0,0,0.52)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8
  },
  cardBio: {
    maxWidth: 330,
    marginTop: 5,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6
  },
  socialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 11
  },
  socialPill: {
    minHeight: 31,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1
  },
  socialPillText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800"
  },
  matchInlinePill: {
    alignSelf: "flex-start",
    minHeight: 29,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    color: colors.primary,
    backgroundColor: "rgba(255,45,141,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.22)"
  },
  matchInlinePillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900"
  },

  matchScorePill: {
    position: "absolute",
    left: 24,
    bottom: 220,
    zIndex: 5,
    gap: 2,
    maxWidth: "86%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  matchScoreText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  matchReasonText: {
    color: colors.inkSoft,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800"
  },
  profileSafetyRow: {
    flexDirection: "row",
    gap: 10
  },
  profileSafetyButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    gap: 7,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)"
  },
  profileSafetyText: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18
  },
  roundAction: {
    position: "relative",
    width: 74,
    height: 74,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    boxShadow: "0 16px 34px rgba(99,51,61,0.12)"
  },
  roundActionLarge: {
    width: 92,
    height: 92
  },
  roundActionPrimary: {
    backgroundColor: colors.primary,
    boxShadow: "0 18px 40px rgba(255,45,141,0.35)"
  },
  roundActionLocked: {
    opacity: 0.74,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.22)"
  },
  roundActionLockBadge: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.12)"
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
  premiumHero: {
    gap: 12,
    padding: 22,
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.22)",
    boxShadow: "0 26px 70px rgba(255,45,141,0.22)"
  },
  premiumHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  premiumHeroKicker: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  premiumCrown: {
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    color: "#fff",
    textAlign: "center",
    backgroundColor: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  premiumHeroTitle: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: 0
  },
  premiumHeroText: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 21
  },
  premiumBenefitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  premiumBenefit: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    color: colors.primaryDeep,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)",
    fontSize: 12,
    fontWeight: "900"
  },
  planList: {
    gap: 14
  },
  planCard: {
    gap: 15,
    padding: 16,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)",
    boxShadow: `0 18px 42px ${colors.shadow}`
  },
  planCardActive: {
    borderColor: "rgba(255,45,141,0.58)",
    backgroundColor: colors.cardTinted,
    boxShadow: "0 22px 52px rgba(255,45,141,0.2)"
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  planIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,45,141,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.22)"
  },
  planIconActive: {
    backgroundColor: colors.primary,
    borderColor: colors.fillStronger
  },
  planTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  planAccent: {
    marginTop: 3,
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  planPriceColumn: {
    alignItems: "flex-end",
    gap: 9
  },
  planPrice: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: "900"
  },
  planBadge: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    color: colors.ink,
    backgroundColor: "rgba(255,45,141,0.16)",
    fontSize: 11,
    fontWeight: "900"
  },
  planSelectDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  planSelectDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  planFeatures: {
    gap: 8,
    paddingTop: 3
  },
  planFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  planFeature: {
    flex: 1,
    color: "#f0c9da",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  matchOverview: {
    flexDirection: "row",
    gap: 8
  },
  matchOverviewItem: {
    flex: 1,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 20,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  matchOverviewValue: {
    color: colors.primary,
    fontSize: 21,
    fontWeight: "900",
    fontVariant: ["tabular-nums"]
  },
  matchOverviewLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800"
  },
  matchSection: {
    gap: 10
  },
  matchSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 3
  },
  matchSectionHeaderAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  matchSectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  matchSectionCount: {
    overflow: "hidden",
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900",
    fontVariant: ["tabular-nums"]
  },
  matchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  matchToolbar: {
    gap: 10
  },
  matchFilterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  matchFilterPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  matchFilterPillActive: {
    backgroundColor: "rgba(255,45,141,0.18)",
    borderColor: "rgba(255,45,141,0.72)"
  },
  matchFilterText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900"
  },
  matchFilterTextActive: {
    color: "#fff"
  },
  matchViewSwitch: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  matchViewButton: {
    width: 38,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  matchViewButtonActive: {
    backgroundColor: colors.primary
  },
  matchFilterEmpty: {
    minHeight: 92,
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  matchFilterEmptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  matchList: {
    flexDirection: "column",
    flexWrap: "nowrap",
    gap: 8
  },
  matchCard: {
    position: "relative",
    width: "48%",
    overflow: "hidden",
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.fillStrong,
    boxShadow: `0 16px 34px ${colors.shadow}`
  },
  matchCardList: {
    width: "100%",
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center"
  },
  matchImage: {
    width: "100%",
    aspectRatio: 4 / 5
  },
  matchImageList: {
    width: 68,
    height: 68,
    marginLeft: 10,
    borderRadius: 18,
    aspectRatio: undefined
  },
  matchCardCopy: {
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  matchName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  matchSubtitle: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700"
  },
  matchActiveBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    boxShadow: "0 8px 20px rgba(255,45,141,0.34)"
  },
  pendingMatchList: {
    gap: 8
  },
  pendingMatchRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 10,
    borderRadius: 20,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  pendingMatchAvatar: {
    width: 52,
    height: 52,
    borderRadius: 17,
    borderCurve: "continuous"
  },
  chatNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  mxHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 6 },
  mxTitle: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: "700", letterSpacing: -0.8 },
  mxHeaderButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.fill },
  mxSection: { gap: 10 },
  mxSectionTitle: { paddingHorizontal: 4, color: colors.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  mxCaption: { paddingHorizontal: 4, color: colors.muted, fontSize: 13, lineHeight: 18 },
  mxCarousel: { gap: 14, paddingHorizontal: 4, paddingVertical: 2 },
  mxMatch: { width: 76, alignItems: "center", gap: 6 },
  mxMatchRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 2.5, padding: 3, alignItems: "center", justifyContent: "center" },
  mxMatchPhoto: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.photoPlaceholder },
  mxMatchName: { maxWidth: 76, color: colors.ink, fontSize: 13, fontWeight: "600" },
  mxGroup: { borderRadius: 18, overflow: "hidden", backgroundColor: colors.surfaceStrong },
  mxDivider: { height: StyleSheet.hairlineWidth, marginLeft: 76, backgroundColor: colors.fillStronger },
  mxRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  mxAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.photoPlaceholder },
  mxNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  mxName: { flexShrink: 1, color: colors.ink, fontSize: 16, fontWeight: "600" },
  mxDot: { width: 7, height: 7, borderRadius: 4 },
  mxSub: { marginTop: 2, color: colors.muted, fontSize: 13 },
  mxLikeBack: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  mxQuiet: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cxSegment: { flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: colors.fill },
  cxSegmentItem: { flex: 1, height: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 9 },
  cxSegmentItemActive: { backgroundColor: colors.name === "dark" ? colors.fillStronger : colors.surfaceStrong, boxShadow: "0 1px 4px rgba(0,0,0,0.12)" },
  cxSegmentText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  cxSegmentTextActive: { color: colors.ink },
  cxSegmentBadge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  cxSegmentBadgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: "700" },
  cxSearch: { height: 38, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, borderRadius: 12, backgroundColor: colors.fill },
  cxSearchInput: { flex: 1, height: 38, color: colors.ink, fontSize: 16 },
  cxDivider: { height: StyleSheet.hairlineWidth, marginLeft: 80, backgroundColor: colors.fillStronger },
  cxRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  cxAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.photoPlaceholder },
  cxTopLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  cxBottomLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  cxNameUnread: { fontWeight: "700" },
  cxTime: { color: colors.muted, fontSize: 13, fontVariant: ["tabular-nums"] },
  cxTimeUnread: { color: colors.primary, fontWeight: "600" },
  cxMessage: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 19 },
  cxMessageUnread: { color: colors.ink, fontWeight: "500" },
  cxUnread: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  cxUnreadText: { color: colors.onPrimary, fontSize: 11, fontWeight: "700" },
  pfIdentity: { alignItems: "center", gap: 4, paddingTop: 4, paddingBottom: 6 },
  pfAvatar: { width: 104, height: 104, borderRadius: 52, marginBottom: 8, backgroundColor: colors.photoPlaceholder },
  pfNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, maxWidth: "90%" },
  pfName: { flexShrink: 1, color: colors.ink, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
  pfMeta: { color: colors.muted, fontSize: 15 },
  pfLink: { marginTop: 4, color: colors.primary, fontSize: 15, fontWeight: "600" },
  pfRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pfRowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  pfRowLabel: { color: colors.ink, fontSize: 16 },
  pfRowSub: { marginTop: 1, color: colors.muted, fontSize: 13 },
  pfRowValue: { color: colors.muted, fontSize: 15 },
  pfDivider: { height: StyleSheet.hairlineWidth, marginLeft: 56, backgroundColor: colors.fillStronger },
  pfProgress: { height: 4, marginTop: 6, borderRadius: 2, overflow: "hidden", backgroundColor: colors.fillStrong },
  pfProgressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  pfSignOut: { color: "#ff3b30", fontSize: 16, fontWeight: "500" },
  pfFootnote: { textAlign: "center", color: colors.muted, fontSize: 13 },
  stHeader: { flexDirection: "row", alignItems: "center", marginLeft: -8 },
  stBack: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingRight: 8 },
  stBackText: { color: colors.primary, fontSize: 17 },
  stGroupWrap: { gap: 7 },
  stGroupTitle: { paddingHorizontal: 16, color: colors.muted, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.2 },
  stFooter: { paddingHorizontal: 16, color: colors.muted, fontSize: 13, lineHeight: 18 },
  fpSheet: { width: "100%", maxHeight: "94%", zIndex: 2, paddingTop: 8, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.background, overflow: "hidden", boxShadow: `0 -16px 40px ${colors.shadow}` },
  fpHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  fpHeaderSide: { width: 90 },
  fpHeaderAction: { color: colors.primary, fontSize: 16 },
  fpTitle: { flex: 1, textAlign: "center", color: colors.ink, fontSize: 17, fontWeight: "600" },
  fpClose: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.fill },
  fpScroll: { gap: 22, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },
  fpRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  fpChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fpChip: { height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.fill },
  fpChipActive: { backgroundColor: colors.primary },
  fpChipText: { color: colors.ink, fontSize: 14, fontWeight: "500" },
  fpChipTextActive: { color: colors.onPrimary, fontWeight: "600" },
  fpFooter: { gap: 6, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.fillStronger },
  fpApply: { height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary },
  fpApplyText: { color: colors.onPrimary, fontSize: 17, fontWeight: "600" },
  fpCaption: { textAlign: "center", color: colors.muted, fontSize: 12 },
  mxEmpty: { alignItems: "center", gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  mxEmptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  mxEmptyText: { maxWidth: 300, color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  pendingMatchName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  pendingMatchText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700"
  },
  incomingLikeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    boxShadow: "0 8px 20px rgba(255,45,141,0.28)"
  },
  pendingSparkLikeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff7a18",
    boxShadow: "0 8px 20px rgba(255,122,24,0.32)"
  },
  pendingCancelButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,45,141,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)"
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
    borderColor: "rgba(255,45,141,0.16)"
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
    gap: 12
  },
  chatToggleRow: {
    flexDirection: "row",
    gap: 10,
    padding: 5,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card
  },
  chatToggleButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 19,
    backgroundColor: colors.fill
  },
  chatToggleButtonActive: {
    backgroundColor: colors.primary,
    boxShadow: "0 10px 28px rgba(255,45,141,0.34)"
  },
  chatToggleText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "900"
  },
  chatToggleTextActive: {
    color: colors.ink
  },
  chatToggleCount: {
    overflow: "hidden",
    minWidth: 24,
    borderRadius: 999,
    backgroundColor: colors.fillStrong,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  chatToggleCountActive: {
    backgroundColor: "rgba(0,0,0,0.18)",
    color: colors.ink
  },
  chatMiniInfo: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,45,141,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  chatMiniInfoText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  chatSection: {
    gap: 8
  },
  chatSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4
  },
  chatSectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  chatSectionBadge: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.primary,
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 4
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
  chatNameUnread: {
    color: "#fff"
  },
  chatMessage: {
    maxWidth: 210,
    marginTop: 3,
    color: colors.muted,
    fontSize: 13
  },
  chatMessageUnread: {
    color: "#e9e3e8",
    fontWeight: "800"
  },
  chatMetaColumn: {
    alignItems: "flex-end",
    gap: 7
  },
  chatTime: {
    color: colors.muted,
    fontSize: 12
  },
  unreadPill: {
    overflow: "hidden",
    minWidth: 22,
    borderRadius: 999,
    backgroundColor: colors.primary,
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  chatItemActive: {
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)",
    backgroundColor: colors.cardTinted
  },
  threadPanel: {
    gap: 14,
    padding: 16,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  threadTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  threadStatus: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  threadMiniInfo: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  threadActions: {
    flexDirection: "row",
    gap: 8
  },
  threadActionButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,45,141,0.18)"
  },
  threadActionText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: "900"
  },
  requestCard: {
    gap: 4,
    padding: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,45,141,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.13)"
  },
  requestTitle: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: "900"
  },
  requestText: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18
  },
  messageStack: {
    gap: 8
  },
  messageBubble: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.card
  },
  messageBubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary
  },
  messageText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  messageTextMine: {
    color: "#fff"
  },
  messageComposer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 6,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(145,110,111,0.12)"
  },
  messageInput: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700"
  },
  messageSendButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  messageSendButtonDisabled: {
    backgroundColor: "rgba(255,45,141,0.32)"
  },
  messageSendText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  emptyStateCard: {
    minHeight: 150,
    justifyContent: "center",
    gap: 8,
    padding: 18,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)",
    boxShadow: "0 16px 34px rgba(99,51,61,0.08)"
  },
  emptyStateIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  emptyStateTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  emptyStateText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20
  },
  profileScreen: {
    gap: 14,
    paddingTop: 2,
    paddingBottom: 12
  },
  profileTopBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  profileRoundIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  profileTopTitle: {
    color: colors.ink,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900"
  },
  profileIdentitySection: {
    gap: 16,
    padding: 16,
    borderRadius: 30,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)",
    boxShadow: `0 24px 60px ${colors.shadow}`
  },
  profileIdentityTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  profileIdentityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8
  },
  profileMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  profileMetaPill: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)"
  },
  profileMetaText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900"
  },
  profileHeroActions: {
    flexDirection: "row",
    gap: 10
  },
  profileSecondaryButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  profileSecondaryButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  profileAvatarWrap: {
    width: 104,
    height: 104,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceStrong,
    boxShadow: "0 0 34px rgba(255,45,141,0.34)"
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%"
  },
  profileAvatarEdit: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: "rgba(18,18,25,0.95)"
  },
  profileNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minWidth: 0
  },
  profileDisplayName: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900"
  },
  profileProPill: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.fillStrong,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  profileProText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  profileEditCta: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 999,
    backgroundColor: colors.primary,
    boxShadow: "0 16px 38px rgba(255,45,141,0.32)"
  },
  profileEditCtaText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  profileQuickStats: {
    flexDirection: "row",
    gap: 8
  },
  profileQuickStat: {
    flex: 1,
    minHeight: 70,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)"
  },
  profileQuickStatValue: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
    fontVariant: ["tabular-nums"]
  },
  profileQuickStatLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  profileGrowthPanel: {
    gap: 14,
    padding: 16,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.28)",
    boxShadow: "0 18px 44px rgba(255,45,141,0.14)"
  },
  profileGrowthHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  profileGrowthIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    boxShadow: "0 12px 28px rgba(255,45,141,0.3)"
  },
  profileGrowthEyebrow: {
    color: colors.primaryDeep,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1
  },
  profileGrowthTitle: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  profileGrowthHint: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700"
  },
  profileGrowthActions: {
    flexDirection: "row",
    gap: 9
  },
  profileGrowthPrimary: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  profileGrowthPrimaryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  profileGrowthSecondary: {
    minWidth: 104,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  profileGrowthSecondaryText: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  profileGalleryPanel: {
    gap: 14,
    padding: 14,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
  },
  profilePreviewPanel: {
    gap: 14,
    padding: 14,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
  },
  profilePreviewFrame: {
    height: 540,
    overflow: "hidden",
    borderRadius: 32,
    backgroundColor: "#08070a"
  },
  profileGalleryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  photoEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill
  },
  profileSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  profilePlanBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    color: colors.primary,
    backgroundColor: "rgba(255,45,141,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)",
    fontSize: 12,
    fontWeight: "900"
  },
  profileHeroShell: {
    gap: 10
  },
  profileHero: {
    aspectRatio: 4 / 5,
    maxHeight: 560,
    overflow: "hidden",
    borderRadius: 32,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceStrong,
    boxShadow: `0 26px 66px ${colors.shadow}`
  },
  profileHeroImage: {
    width: "100%",
    height: "100%"
  },
  profileHeroShade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  },
  profileHeroMeta: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18
  },
  profileHeroLabel: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    color: colors.ink,
    backgroundColor: colors.card,
    fontSize: 12,
    fontWeight: "900"
  },
  profileHeroTitle: {
    color: "#fff",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: 0
  },
  photoFormatHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700"
  },
  photoProHint: {
    marginTop: 2,
    color: colors.primaryDeep,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900"
  },
  photoLimitBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  photoAddButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  photoAddText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  photoSlot: {
    width: "30.8%",
    minWidth: 0,
    aspectRatio: 4 / 5,
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  photoSlotImage: {
    width: "100%",
    height: "100%"
  },
  photoRemoveButton: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 30,
    height: 30,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)"
  },
  photoEmptyText: {
    color: colors.primaryDeep,
    textAlign: "center",
    textAlignVertical: "center",
    width: "100%",
    height: "100%",
    fontSize: 32,
    fontWeight: "900"
  },
  photoSlotBadge: {
    position: "absolute",
    left: 7,
    right: 7,
    bottom: 7,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    color: colors.ink,
    textAlign: "center",
    backgroundColor: colors.card,
    fontSize: 10,
    fontWeight: "900"
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
  profileHeroCrown: {
    position: "absolute",
    top: 18,
    left: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    color: "#3a2500",
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)",
    fontSize: 12,
    fontWeight: "900"
  },
  profilePanel: {
    gap: 14,
    padding: 14,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.12)"
  },
  profileName: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0
  },
  profileDescription: {
    color: colors.inkSoft,
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
  proFeaturePanel: {
    gap: 10,
    padding: 14,
    borderRadius: 24,
    backgroundColor: "rgba(255,45,141,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  proFeatureHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  proFeatureSubtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  proFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  proFeatureText: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800"
  },
  proMiniButton: {
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink
  },
  proMiniButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  incomingLikesPanel: {
    gap: 14,
    padding: 14,
    borderRadius: 24,
    backgroundColor: colors.cardTinted,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  incomingLikesCount: {
    minWidth: 42,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    color: colors.primaryDeep,
    textAlign: "center",
    backgroundColor: colors.card,
    fontSize: 12,
    fontWeight: "900"
  },
  incomingLikesRow: {
    flexDirection: "row",
    gap: 10
  },
  incomingLikeItem: {
    flex: 1,
    gap: 7,
    alignItems: "center"
  },
  incomingLikeImage: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 18,
    borderCurve: "continuous",
    overflow: "hidden"
  },
  incomingLikeName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  lockedLikesButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)"
  },
  lockedLikesText: {
    color: colors.primaryDeep,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "900"
  },
  socialList: {
    gap: 8
  },
  socialLinkRow: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.fill
  },
  socialIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  socialLinkCopy: {
    flex: 1,
    gap: 2
  },
  socialHandleGrid: {
    gap: 9
  },
  socialHandleField: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1
  },
  socialHandleIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center"
  },
  socialHandleLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900"
  },
  socialHandleInputRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 32
  },
  socialHandleAt: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  socialHandleInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    paddingHorizontal: 4,
    color: "#f6eaf0",
    fontSize: 14,
    fontWeight: "800"
  },
  socialHandleHint: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  signOutButton: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255,62,105,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,102,143,0.2)"
  },
  signOutIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,102,143,0.12)"
  },
  signOutTitle: {
    color: "#ff8bab",
    fontSize: 14,
    fontWeight: "900"
  },
  signOutHint: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  settingsList: {
    gap: 10,
    paddingTop: 2
  },
  simpleInterestBox: {
    gap: 12
  },
  simpleInterestTop: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)"
  },
  simpleInterestCount: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: "900"
  },
  simpleInterestHint: {
    flex: 1,
    color: colors.muted,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800"
  },
  selectedInterestEmpty: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  simpleInterestDivider: {
    height: 1,
    backgroundColor: colors.fillStrong
  },
  simpleInterestMoreButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,45,141,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
  },
  simpleInterestMoreText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: "900"
  },
  primaryInterestPanel: {
    gap: 10,
    paddingTop: 4
  },
  accordionHeader: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  accordionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  interestPicker: {
    gap: 14
  },
  interestCategoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  interestCategoryTile: {
    width: "48%",
    minHeight: 104,
    flexGrow: 1,
    justifyContent: "space-between",
    gap: 8,
    padding: 12,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)"
  },
  interestCategoryTileActive: {
    backgroundColor: "rgba(255,45,141,0.15)",
    borderColor: colors.primary,
    boxShadow: "0 12px 28px rgba(255,45,141,0.14)"
  },
  interestCategoryIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "rgba(255,45,141,0.1)"
  },
  interestCategoryIconActive: {
    backgroundColor: colors.primary
  },
  interestCategoryTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  interestCategoryTitleActive: {
    color: "#fff"
  },
  interestCategoryTileFooter: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6
  },
  interestCategoryMeta: {
    flexShrink: 1,
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800"
  },
  interestCategoryCount: {
    minWidth: 21,
    height: 21,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  interestCategoryCountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900"
  },
  interestOptionsPanel: {
    gap: 12,
    padding: 13,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  interestOptionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  interestOptionsEyebrow: {
    color: colors.primary,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900"
  },
  interestOptionsTitle: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900"
  },
  interestOptionsCounter: {
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    color: colors.primary,
    backgroundColor: "rgba(255,45,141,0.12)",
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900"
  },
  interestOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  interestOptionTile: {
    width: "48%",
    minHeight: 68,
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 17,
    borderWidth: 1
  },
  interestOptionTileDisabled: {
    opacity: 0.38
  },
  interestOptionIcon: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11
  },
  interestOptionText: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900"
  },
  interestOptionTextActive: {
    color: "#fff"
  },
  settingRow: {
    minHeight: 58,
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.fill
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)",
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
    color: colors.inkSoft,
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
    backgroundColor: "rgba(255,45,141,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)"
  },
  deleteTitle: {
    color: colors.primaryDeep,
    fontSize: 16,
    fontWeight: "900"
  },
  deleteText: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 19
  },
  deleteAccountButton: {
    minHeight: 48,
    marginTop: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    boxShadow: "0 14px 34px rgba(255,45,141,0.26)"
  },
  deleteAccountButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  matchCelebrationBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.scrim
  },
  matchCelebrationCard: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
    borderRadius: 30,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.36)",
    boxShadow: "0 28px 80px rgba(255,45,141,0.28)"
  },
  matchCelebrationGlow: {
    position: "absolute",
    top: -90,
    width: 260,
    height: 180,
    borderRadius: 100,
    backgroundColor: "rgba(255,45,141,0.28)",
    boxShadow: "0 0 90px rgba(255,45,141,0.48)"
  },
  matchCelebrationIcon: {
    width: 66,
    height: 66,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    boxShadow: "0 12px 32px rgba(255,45,141,0.42)"
  },
  sparkLikeCelebrationGlow: {
    top: -74,
    backgroundColor: "rgba(255,112,30,0.34)",
    boxShadow: "0 0 110px rgba(255,86,26,0.68)"
  },
  sparkLikeCelebrationIcon: {
    backgroundColor: "#ff6a22",
    boxShadow: "0 12px 38px rgba(255,97,31,0.6)"
  },
  matchCelebrationKicker: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1
  },
  matchCelebrationTitle: {
    color: "#fff",
    fontSize: 36,
    lineHeight: 41,
    fontWeight: "900"
  },
  matchCelebrationText: {
    maxWidth: 320,
    color: "#e8c7d5",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontWeight: "700"
  },
  matchCelebrationPhoto: {
    width: 78,
    height: 96,
    marginVertical: 2,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 3,
    borderColor: colors.primary
  },
  matchStarterSection: {
    width: "100%",
    gap: 7,
    padding: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: colors.fillStrong
  },
  matchStarterHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 1
  },
  matchStarterHeadingText: {
    color: colors.primaryDeep,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  matchStarterOption: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: "rgba(255,45,141,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
  },
  matchStarterOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  matchStarterOptionText: {
    flex: 1,
    color: "#f1d9e4",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800"
  },
  matchStarterOptionTextActive: {
    color: "#fff"
  },
  matchCelebrationPrimary: {
    width: "100%",
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  matchCelebrationPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900"
  },
  matchCelebrationSecondary: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  matchCelebrationSecondaryText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  bottomNav: { position: "absolute", left: 14, right: 14, bottom: 6, minHeight: 64, flexDirection: "row", gap: 2, padding: 5, borderRadius: 28, overflow: "hidden", backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder, boxShadow: colors.name === "light" ? "0 10px 28px rgba(150,60,120,0.14)" : "0 10px 28px rgba(0,0,0,0.45)" },
  navButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  navButtonActive: { backgroundColor: colors.primarySoft },
  navIconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  navUnreadBadge: {
    position: "absolute",
    top: -7,
    right: -13,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: "#151218"
  },
  navUnreadBadgeText: {
    color: "#fff",
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900"
  },
  navIcon: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "900"
  },
  navText: { color: colors.inkSoft, fontSize: 10.5, lineHeight: 13, fontWeight: "600" },
  navTextActive: {
    color: colors.primary
  }
});
}

const themedStyles = { dark: createStyles(palettes.dark), light: createStyles(palettes.light) };
type AppStyles = ReturnType<typeof createStyles>;

/** Current palette + matching StyleSheet (light/dark). */
function useAppTheme(): { colors: Palette; styles: AppStyles; theme: ReturnType<typeof useThemeState> } {
  const theme = useThemeState();
  return { colors: theme.palette, styles: themedStyles[theme.name], theme };
}
