import AsyncStorage from "@react-native-async-storage/async-storage";
import { FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { BlurView } from "expo-blur";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
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
import { currentUserUsesAppleSignIn, deleteCurrentUserAccount, ensureRecentLoginForAccountDeletion, getRevenueCatEntitlements, observeAuthState, reauthenticateAndRevokeApple, requestPasswordReset, signInWithAppleIdToken, signInWithEmail, signInWithGoogleIdToken, signOutUser, signUpWithEmail, type AppAuthUser } from "./src/auth";
import { firebaseConfigStatus, isFirebaseConfigured } from "./src/firebase";
import { findModerationViolation } from "./src/content-moderation";
import {
  acceptChatRequest,
  blockUser,
  cancelChatRequest,
  cancelProfileLike,
  createMatchThread,
  createReport,
  findIncomingProfileLikes,
  findMatchThreadsForUser,
  findOutgoingProfileSwipes,
  findProfilesByInterest,
  findTestProfiles,
  getMonthlySuperlikeUsage,
  getPublicProfile,
  getUserProfile,
  getUserPrivateSettings,
  hasIncomingProfileLike,
  observeBlockedProfileKeys,
  observeUserChats,
  recordProfileSwipe,
  recordUserLogin,
  rejectChatRequest,
  requestAccountDeletionAndDeleteProfile,
  sendChatMessage,
  syncPublicUserProfile,
  updateUserDiscoveryPreferences,
  upsertUserProfile,
  upsertUserPrivateSettings,
  type DiscoveryCursor
} from "./src/firestore";
import { googleClientIds, isGoogleSignInConfigured } from "./src/google-sign-in";
import { openAdsPrivacyOptions, SparkAdBanner, useGoogleMobileAds, useSwipeInterstitialAds } from "./src/ads";
import { hasSparknewPro, revenueCatEntitlementId, useRevenueCat, type RevenueCatState, type SparkPlanId } from "./src/revenuecat";
import { deleteProfilePhotos, uploadProfilePhotos } from "./src/profile-storage";
import { getInitialSparkNotificationRoute, observeSparkNotificationResponses, registerSparkPushNotifications } from "./src/notifications";


const colors = {
  background: "#050507",
  surface: "rgba(20,20,26,0.86)",
  surfaceStrong: "#15151c",
  ink: "#f8f4f7",
  muted: "#a7a0aa",
  primary: "#ff2d8d",
  primaryDeep: "#ff69ad",
  primarySoft: "rgba(255,45,141,0.18)",
  line: "rgba(255,45,141,0.22)",
  green: "#42d982",
  gold: "#ffbd59"
};

const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || "sparkapp@gmail.com";
const legalLinks = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || "https://spark-new-legal.vercel.app/privacy",
  terms: process.env.EXPO_PUBLIC_TERMS_URL || "https://spark-new-legal.vercel.app/terms",
  community: process.env.EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL || "https://spark-new-legal.vercel.app/community-guidelines"
};
const showDemoLogin = __DEV__ && process.env.EXPO_PUBLIC_SHOW_DEMO_LOGIN === "true";
const configuredTestProfileViewerEmails = (process.env.EXPO_PUBLIC_TEST_PROFILE_VIEWER_EMAILS || "wychor234@gmail.com")
  .split(",")
  .map((value: string) => value.trim().toLowerCase())
  .filter(Boolean);

function openSupportEmail(subject = "Spark - pomoc") {
  const mailto = "mailto:" + supportEmail + "?subject=" + encodeURIComponent(subject);
  Linking.openURL(mailto).catch(() => {
    Alert.alert("Pomoc", "Napisz do nas: " + supportEmail);
  });
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
const headerLogoImage = require("./assets/header.png");
const loginLogoImage = require("./assets/loginpagelogo.png");

const profileImages = [
  require("./assets/profiles/profile-1.jpg"),
  require("./assets/profiles/profile-2.jpg"),
  require("./assets/profiles/profile-3.jpg"),
  require("./assets/profiles/profile-4.jpg"),
  require("./assets/profiles/profile-5.jpg"),
  require("./assets/profiles/profile-6.jpg")
];

const bundledTestProfileImages: Record<string, any> = {
  spark_test_kuba: profileImages[3],
  spark_test_maja: profileImages[4],
  spark_test_alex: profileImages[5]
};

const demoAccount = {
  email: "tester@spark.app",
  password: "sparkdemo",
  firstName: "Tester",
  lastName: "Spark"
};

function getSocialIcon(label: string): { family: SocialIconFamily; name: string; color: string; backgroundColor: string } {
  const normalized = label.toLowerCase();

  if (normalized.includes("instagram") || normalized === "ig" || normalized.includes("@")) {
    return { family: "fontAwesome", name: "instagram", color: "#ff4fa3", backgroundColor: "rgba(255,79,163,0.16)" };
  }

  if (normalized.includes("tiktok")) {
    return { family: "fontAwesome5", name: "tiktok", color: "#f4f6ff", backgroundColor: "rgba(244,246,255,0.13)" };
  }

  if (normalized.includes("spotify") || normalized.includes("muzyka") || normalized.includes("music")) {
    return { family: "fontAwesome", name: "spotify", color: "#1ed760", backgroundColor: "rgba(30,215,96,0.15)" };
  }

  return { family: "material", name: "link-variant", color: colors.primaryDeep, backgroundColor: colors.primarySoft };
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

type Tab = "discover" | "matches" | "messages" | "premium" | "profile" | "safety";
type DiscoverFilters = { proOnly: boolean; requireCommonInterests: boolean; includeProfilesWithoutLocation: boolean; targetInterests: string[]; maxDistanceKm: number; ageMin: number; ageMax: number };
const createDefaultDiscoverFilters = (): DiscoverFilters => ({ proOnly: false, requireCommonInterests: false, includeProfilesWithoutLocation: true, targetInterests: [], maxDistanceKm: 100, ageMin: 18, ageMax: 35 });
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
  requestDirection?: "incoming" | "outgoing";
  status: ChatStatus;
  introMessage?: string;
  messages: Array<{ id: string; from: "me" | "them"; text: string; time: string }>;
};

type MatchProfile = {
  id?: string;
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
  featuredInterests?: string[];
  socials: { label: string; value: string }[];
  premium?: boolean;
  likedYou?: boolean;
  isTestProfile?: boolean;
  desiredAgeMin?: number;
  desiredAgeMax?: number;
  heightCm?: number;
  weightKg?: number;
  matchScore?: number;
  interestMatchPercent?: number;
  matchReasons?: string[];
  intent?: string;
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
    desiredAgeMin: 23,
    desiredAgeMax: 35,
    heightCm: 184,
    weightKg: 78,
    socials: [
      { label: "Spotify", value: "Kuba live set" }
    ]
  },
  {
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
  return profile.id ?? `${profile.name}-${profile.surname}`;
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
  const id = typeof item.id === "string" ? item.id : null;
  const nameMode = item.profileNameMode === "nickname" ? "nickname" : "realName";
  const nickname = typeof item.nickname === "string" ? repairLegacyText(item.nickname.trim()) : "";
  const firstName = typeof item.firstName === "string" ? repairLegacyText(item.firstName.trim()) : "";
  const name = nameMode === "nickname" && nickname ? nickname : firstName;
  const surname = typeof item.lastName === "string" ? repairLegacyText(item.lastName.trim()) : "";
  const interests = Array.isArray(item.interests) ? item.interests.filter((value): value is string => typeof value === "string").map(repairLegacyText) : [];
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
  const socialsRecord = typeof item.socials === "object" && item.socials !== null ? item.socials as Record<string, unknown> : {};
  const socials = Object.entries(socialsRecord)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0 && !entry[0].toLowerCase().includes("linkedin"))
    .map(([label, value]) => ({ label: repairLegacyText(label), value: repairLegacyText(value) }));
  const updatedAt = item.updatedAt as { toMillis?: () => number } | undefined;

  return {
    id,
    name,
    surname,
    age: typeof item.age === "number" ? Math.max(18, Math.min(99, Math.round(item.age))) : 18,
    city: typeof item.city === "string" && item.city.trim() ? repairLegacyText(item.city.trim()) : "Twoja okolica",
    country: typeof item.country === "string" && item.country.trim() ? repairLegacyText(item.country.trim()) : undefined,
    bio: typeof item.bio === "string" && item.bio.trim()
      ? repairLegacyText(item.bio.trim())
      : typeof item.intent === "string" && item.intent.trim()
        ? "Jestem tu po: " + repairLegacyText(item.intent.trim()) + "."
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
    likedYou: item.likedYou === true,
    isTestProfile: item.isTestProfile === true,
    desiredAgeMin: typeof item.desiredAgeMin === "number" ? item.desiredAgeMin : 18,
    desiredAgeMax: typeof item.desiredAgeMax === "number" ? item.desiredAgeMax : 99,
    heightCm: typeof item.heightCm === "number" ? item.heightCm : undefined,
    weightKg: typeof item.weightKg === "number" ? item.weightKg : undefined,
    intent: typeof item.intent === "string" ? repairLegacyText(item.intent.trim()) : undefined,
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
  return Math.max(1, Math.round(distanceKm)) + " km";
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
  userIntent: string;
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
  const viewerIntent = params.userIntent.trim().toLocaleLowerCase("pl");
  const profileIntent = (params.profile.intent ?? "").trim().toLocaleLowerCase("pl");
  const sameIntent = Boolean(viewerIntent && profileIntent && viewerIntent === profileIntent);
  const communityPair = viewerIntent.includes("społeczność") || profileIntent.includes("społeczność");
  const intentScore = sameIntent ? 18 : communityPair ? 9 : viewerIntent && profileIntent ? 5 : 3;
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
  const dayKey = new Date().toISOString().slice(0, 10);
  const rotationSeed = `${params.viewerUid}:${getProfileKey(params.profile)}:${dayKey}`;
  const rotationScore = Array.from(rotationSeed).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7) % 5;
  const score = Math.max(15, Math.min(98, interestScore + intentScore + distanceScore + ageScore + preferenceScore + completenessScore + freshnessScore + rotationScore));
  const reasons = [
    sameIntent ? "oboje wybieracie: " + params.profile.intent : params.profile.intent ? "cel profilu: " + params.profile.intent : "otwarty profil",
    interestMatchPercent + "% zgodności zainteresowań",
    distanceKm === null ? [params.profile.city, params.profile.country].filter(Boolean).join(", ") || "lokalizacja ukryta" : Math.max(1, Math.round(distanceKm)) + " km od Ciebie"
  ];
  return { score, reasons, sharedInterests, interestMatchPercent };
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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [authDone, setAuthDone] = useState(false);
  const [authRestoring, setAuthRestoring] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileNameMode, setProfileNameMode] = useState<ProfileNameMode>("realName");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [onboarded, setOnboarded] = useState(false);
  const [intent, setIntent] = useState("Randki");
  const [ageBand, setAgeBand] = useState<AgeBand>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("discover");
  const [discoverFilters, setDiscoverFilters] = useState<DiscoverFilters>(createDefaultDiscoverFilters);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [premiumPlan, setPremiumPlan] = useState<SparkPlanId>("monthly");
  const [appUser, setAppUser] = useState<AppAuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);
  const revenueCat = useRevenueCat(appUser?.uid ?? null);
  const adsReady = useGoogleMobileAds(!revenueCat.isPro);
  const trackSwipeAd = useSwipeInterstitialAds(!revenueCat.isPro && adsReady);
  const showCurrentBanner =
    !revenueCat.isPro && adsReady && (tab === "discover" || tab === "matches" || tab === "messages");
  const [likedProfileKeys, setLikedProfileKeys] = useState<string[]>([]);
  const [passedProfileKeys, setPassedProfileKeys] = useState<string[]>([]);
  const [matchedProfileKeys, setMatchedProfileKeys] = useState<string[]>([]);
  const [matchCelebrationProfile, setMatchCelebrationProfile] = useState<MatchProfile | null>(null);
  const [chatRequestKeys, setChatRequestKeys] = useState<string[]>([]);
  const [incomingLikeKinds, setIncomingLikeKinds] = useState<Record<string, "like" | "superlike">>({});
  const [blockedProfileKeys, setBlockedProfileKeys] = useState<string[]>([]);
  const [chatThreads, setChatThreads] = useState<Record<string, ChatThread>>({});
  const sendingMessageKeysRef = useRef(new Set<string>());
  const recentMessageTimesRef = useRef<number[]>([]);
  const [selectedChatKey, setSelectedChatKey] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [superlikesRemaining, setSuperlikesRemaining] = useState(10);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [userCity, setUserCity] = useState("");
  const [userCountry, setUserCountry] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [locationBusy, setLocationBusy] = useState(false);
  const [userAge, setUserAge] = useState(18);
  const [profilePhotos, setProfilePhotos] = useState<ProfilePhoto[]>([]);
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const [remoteProfiles, setRemoteProfiles] = useState<MatchProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileFeedError, setProfileFeedError] = useState<string | null>(null);
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [profileCursor, setProfileCursor] = useState<DiscoveryCursor | null>(null);
  const [profilesHaveMore, setProfilesHaveMore] = useState(false);
  const [profilesLoadingMore, setProfilesLoadingMore] = useState(false);
  const [nextTestResetAt, setNextTestResetAt] = useState<number | null>(null);


  const isCompact = width < 380;
  const profileLookupInterests = useMemo(
    () => Array.from(new Set([...discoverFilters.targetInterests, ...selectedInterests])).slice(0, 10),
    [discoverFilters.targetInterests, selectedInterests]
  );
  const profileQueryKey = profileLookupInterests.slice().sort().join("|");
  const availableProfiles = useMemo(
    () => (remoteProfiles.length > 0 ? remoteProfiles : __DEV__ ? matchProfiles : []),
    [remoteProfiles]
  );
  const profileName = getProfileDisplayName(profileNameMode, nickname, firstName, lastName);
  const canViewTestProfiles = __DEV__ || configuredTestProfileViewerEmails.includes(email.trim().toLowerCase());
  const sortedProfiles = useMemo(
    () =>
      availableProfiles
        .filter((profile) => getProfileKey(profile) !== appUser?.uid)
        .filter((profile) => !blockedProfileKeys.includes(getProfileKey(profile)))
        .filter((profile) => profile.age >= discoverFilters.ageMin && profile.age <= discoverFilters.ageMax)

        .filter((profile) => {
          const distance = getDistanceKm(userLocation, profile);
          return distance === null ? discoverFilters.includeProfilesWithoutLocation : distance <= discoverFilters.maxDistanceKm;
        })
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
            userIntent: intent,
            viewerUid: appUser?.uid ?? "guest"
          });

          return {
            ...profile,
            distance: getApproxDistanceLabel(userLocation, profile),
            matchScore: result.score,
            interestMatchPercent: result.interestMatchPercent,
            matchReasons: result.reasons
          };
        })
        .sort((left, right) => {
          const scoreDifference = (right.matchScore ?? 0) - (left.matchScore ?? 0);
          return scoreDifference || (right.updatedAtMs ?? 0) - (left.updatedAtMs ?? 0) || getProfileKey(left).localeCompare(getProfileKey(right));
        }),
    [appUser?.uid, availableProfiles, blockedProfileKeys, discoverFilters, intent, selectedInterests, userAge, userLocation]
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
  const activeProfile = discoverProfiles[0] ?? null;
  const nextProfile = discoverProfiles[1] ?? null;
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
    const openRoute = (route: "matches" | "messages") => setTab(route);
    const unsubscribe = observeSparkNotificationResponses(openRoute);
    void getInitialSparkNotificationRoute().then((route) => {
      if (route) openRoute(route);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = observeAuthState((user) => {
      void (async () => {
        if (!user) {
          if (mounted) {
            setAppUser(null);
            setAuthDone(false);
            setOnboarded(false);
            setAuthRestoring(false);
          }
          return;
        }

        try {
          const [profile, privateSettings] = await Promise.all([getUserProfile(user.uid), getUserPrivateSettings(user.uid)]);
          if (profile) {
            await syncPublicUserProfile(user.uid).catch(() => undefined);
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
            setBirthDate(privateSettings?.birthDate ?? "");
            setIntent(profile.intent ?? "Randki");
            setProfileBio(typeof profile.bio === "string" && profile.bio.trim().length >= 20 ? profile.bio.trim().slice(0, 300) : "Poznajmy si\u0119 przez wsp\u00f3lne zainteresowania i dobr\u0105 rozmow\u0119.");
            setAgeBand(profile.ageBand ?? null);
            setUserAge(privateSettings?.birthDate ? calculateAge(privateSettings.birthDate) ?? profile.age ?? 18 : profile.age ?? 18);
            setUserCity(profile.city ?? "");
            setUserCountry(profile.country ?? "");
            setDiscoverFilters((current) => ({ ...current, ageMin: profile.desiredAgeMin ?? current.ageMin, ageMax: profile.desiredAgeMax ?? current.ageMax, maxDistanceKm: profile.maxDistanceKm ?? current.maxDistanceKm, targetInterests: Array.isArray(profile.desiredInterests) ? profile.desiredInterests : current.targetInterests, requireCommonInterests: Boolean(profile.requireCommonInterests), includeProfilesWithoutLocation: profile.includeProfilesWithoutLocation !== false, proOnly: Boolean(profile.proOnly) }));
            setSelectedInterests(Array.isArray(profile.interests) ? profile.interests.map(repairLegacyText) : []);
            setProfilePhotos(Array.isArray(profile.photoUrls) ? profile.photoUrls : []);
            setPrivateProfile(Boolean(profile.privateProfile));
            setOnboarded(Boolean(profile.onboardingComplete) || ((profile.interests?.length ?? 0) >= 3 && Boolean(profile.ageBand)));
          } else {
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
      findProfilesByInterest(profileLookupInterests),
      canViewTestProfiles ? findTestProfiles() : Promise.resolve([]),
      findOutgoingProfileSwipes(appUser.uid),
      findMatchThreadsForUser(appUser.uid)
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
    if (!appUser || !authDone || !onboarded || !profilesHaveMore || !profileCursor || profilesLoading || profilesLoadingMore || discoverProfiles.length > 6) return;
    let mounted = true;
    setProfilesLoadingMore(true);
    void findProfilesByInterest(profileLookupInterests, profileCursor)
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
    if (!appUser || !authDone || !onboarded || !revenueCat.isPro) {
      setIncomingLikeKinds({});
      return undefined;
    }

    let mounted = true;
    void findIncomingProfileLikes(appUser.uid)
      .then(async (likes) => {
        const uniqueLikes = Array.from(new Map(likes.map((like) => [like.fromUid, like])).values());
        const documents = await Promise.all(uniqueLikes.map((like) => getPublicProfile(like.fromUid)));
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
  }, [appUser, authDone, onboarded, profileReloadKey, revenueCat.isPro]);

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
          requestDirection: thread.createdByUid === appUser.uid ? "outgoing" : "incoming",
          status: thread.status,
          introMessage: thread.introMessage,
          messages: thread.messages.map((message) => ({
            id: message.id,
            from: message.senderUid === appUser.uid ? "me" : "them",
            text: message.text,
            time: message.createdAtMs ? new Date(message.createdAtMs).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : "teraz"
          }))
        };
      });

      setChatThreads(nextThreads);
      setMatchedProfileKeys(matchedKeys);
      setChatRequestKeys(requestedKeys);

      const conversationProfileKeys = Array.from(new Set([...matchedKeys, ...requestedKeys]));
      void Promise.all(conversationProfileKeys.map((profileKey) => getPublicProfile(profileKey))).then((documents) => {
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
    if (!appUser || !onboarded || revenueCat.isLoading || !revenueCat.configured) return undefined;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const syncVerifiedPro = async (attempt: number) => {
      try {
        const claims = await getRevenueCatEntitlements(true);
        if (cancelled) return;
        const claimIsPro = claims.includes(revenueCatEntitlementId);

        if (claimIsPro || !revenueCat.isPro) {
          await syncPublicUserProfile(appUser.uid, claimIsPro);
          if (!cancelled) setProfileReloadKey((value) => value + 1);
          return;
        }

        if (attempt < 3) {
          retryTimer = setTimeout(() => void syncVerifiedPro(attempt + 1), 5000 * (attempt + 1));
        }
      } catch {
        if (!cancelled && attempt < 3) {
          retryTimer = setTimeout(() => void syncVerifiedPro(attempt + 1), 5000 * (attempt + 1));
        }
      }
    };

    void syncVerifiedPro(0);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [appUser, onboarded, revenueCat.configured, revenueCat.isLoading, revenueCat.isPro]);

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
        setAuthError("Has\u0142o musi mie\u0107 co najmniej 8 znak\u00f3w.");
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
        email: appUser.email ?? email,
        intent,
        bio: profileBio.trim().slice(0, 300),
        ageBand: "18+",
        age: calculatedAge,
        interests: selectedInterests,
        photoUrls: persistedPhotos,
        mainPhotoUrl: persistedPhotos[0] ?? null,
        desiredAgeMin: discoverFilters.ageMin,
        desiredAgeMax: discoverFilters.ageMax,
        maxDistanceKm: discoverFilters.maxDistanceKm,
        desiredInterests: discoverFilters.targetInterests,
        requireCommonInterests: discoverFilters.requireCommonInterests,
        proOnly: discoverFilters.proOnly,
        includeProfilesWithoutLocation: discoverFilters.includeProfilesWithoutLocation,
        city: userCity,
        country: userCountry,
        location: getApproximatePublicLocation(userLocation),
        privateProfile,
        onboardingComplete: true,
        socials: {}
      });
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
        requireCommonInterests: nextFilters.requireCommonInterests,
        proOnly: nextFilters.proOnly,
        includeProfilesWithoutLocation: nextFilters.includeProfilesWithoutLocation
      });
      setDiscoverFilters(nextFilters);
      setProfileReloadKey((value) => value + 1);
      return true;
    } catch {
      Alert.alert("Preferencje", "Nie uda\u0142o si\u0119 zapisa\u0107 preferencji. Spr\u00f3buj ponownie.");
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

  function refreshDiscovery() {
    tap();
    setPassedProfileKeys([]);
    setProfileReloadKey((value) => value + 1);
  }

  async function ensureProAccess() {
    if (revenueCat.isPro) return true;

    const currentInfo = await revenueCat.refreshCustomerInfo();
    if (hasSparknewPro(currentInfo)) return true;

    const completed = await revenueCat.presentPaywallIfNeeded();
    if (!completed) return false;

    return hasSparknewPro(await revenueCat.refreshCustomerInfo());
  }

  async function handleSwipe(action: SwipeAction): Promise<SwipeOutcome> {
    const targetProfile = activeProfile;
    const targetKey = activeProfileKey;

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

    if (appUser) {
      try {
        const swipeResult = await recordProfileSwipe({
          swipeId: getThreadId(appUser.uid, targetKey),
          fromUid: appUser.uid,
          toProfileKey: targetKey,
          direction: action,
          matchScore: targetProfile.matchScore,
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
      trackSwipeAd();
      return "passed";
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
      trackSwipeAd();
      return "liked";
    }

    if (appUser) {
      try {
        await createMatchThread({
          matchId: getConversationId(appUser.uid, targetKey),
          memberUids: [appUser.uid, targetKey],
          createdByUid: appUser.uid,
          source: "mutual-like",
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
        messages: []
      }
    }));

    if (Platform.OS === "ios") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setMatchCelebrationProfile(targetProfile);
    trackSwipeAd();
    return "matched";
  }
  async function likeIncomingProfile(profileKey: string) {
    if (!appUser) return;
    const profile = availableProfiles.find((item) => getProfileKey(item) === profileKey);
    if (!profile) return;

    try {
      await recordProfileSwipe({
        swipeId: getThreadId(appUser.uid, profileKey),
        fromUid: appUser.uid,
        toProfileKey: profileKey,
        direction: "like",
        matchScore: profile.matchScore
      });
      await createMatchThread({
        matchId: getConversationId(appUser.uid, profileKey),
        memberUids: [appUser.uid, profileKey],
        createdByUid: appUser.uid,
        source: "mutual-like"
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
          messages: []
        }
      }));
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
      await createMatchThread({
        matchId: getConversationId(appUser.uid, activeProfileKey),
        introMessage: "Hej, mamy wspólne zainteresowania. Chcesz pogadać?",
        memberUids: [appUser.uid, activeProfileKey],
        createdByUid: appUser.uid,
        source: "premium-request",
        resetAtMs: activeProfile.isTestProfile ? Date.now() + 24 * 60 * 60 * 1000 : undefined
      });
    } catch {
      Alert.alert("Pro\u015bba o chat", "Nie uda\u0142o si\u0119 wys\u0142a\u0107 pro\u015bby. Spr\u00f3buj ponownie.");
      return;
    }

    setChatRequestKeys((keys) => (keys.includes(activeProfileKey) ? keys : [...keys, activeProfileKey]));
    setSelectedChatKey(activeProfileKey);
    setChatThreads((threads) => ({
      ...threads,
      [activeProfileKey]: {
        profileKey: activeProfileKey,
        threadId: getConversationId(appUser.uid, activeProfileKey),
        createdByUid: appUser.uid,
        requestDirection: "outgoing",
        status: "requested",
        introMessage: "Hej, mamy wspólne zainteresowania. Chcesz pogadać?",
        messages: []
      }
    }));
    Alert.alert("Pro\u015bba o chat", "Wys\u0142ano pro\u015bb\u0119 do " + activeProfile.name + ".");
  }

  async function sendMessageToProfile(profileKey: string, text: string) {
    const message = text.trim();

    if (!message) {
      return;
    }
    if (message.length > 2000) {
      Alert.alert("Chat", "Wiadomość może mieć maksymalnie 2000 znaków.");
      return;
    }
    if (sendingMessageKeysRef.current.has(profileKey)) {
      return;
    }

    const now = Date.now();
    recentMessageTimesRef.current = recentMessageTimesRef.current.filter((timestamp) => timestamp > now - 60_000);
    const lastMessageAt = recentMessageTimesRef.current.at(-1) ?? 0;
    if (now - lastMessageAt < 700) {
      Alert.alert("Zwolnij", "Odczekaj chwilę przed wysłaniem kolejnej wiadomości.");
      return;
    }
    if (recentMessageTimesRef.current.length >= 20) {
      Alert.alert("Limit wiadomości", "Dla bezpieczeństwa możesz wysłać maksymalnie 20 wiadomości na minutę.");
      return;
    }

    const moderationViolation = findModerationViolation(message);
    if (moderationViolation) {
      Alert.alert("Wiadomo\u015b\u0107 zablokowana", moderationViolation);
      return;
    }

    const thread = chatThreads[profileKey];
    if (!thread || thread.status !== "matched") {
      Alert.alert("Chat", "Wiadomo\u015bci s\u0105 dost\u0119pne po matchu albo po zaakceptowaniu pro\u015bby.");
      return;
    }

    if (!appUser) {
      Alert.alert("Chat", "Zaloguj si\u0119 ponownie, aby wys\u0142a\u0107 wiadomo\u015b\u0107.");
      return;
    }

    sendingMessageKeysRef.current.add(profileKey);
    try {
      await sendChatMessage({
        threadId: thread.threadId ?? getConversationId(appUser.uid, profileKey),
        senderUid: appUser.uid,
        text: message
      });
      recentMessageTimesRef.current.push(Date.now());
      setMessageDraft("");
    } catch {
      Alert.alert("Chat", "Nie uda\u0142o si\u0119 wys\u0142a\u0107 wiadomo\u015bci. Spr\u00f3buj ponownie.");
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
      await cancelProfileLike(getThreadId(appUser.uid, profileKey));
      setLikedProfileKeys((keys) => keys.filter((key) => key !== profileKey));
    } catch {
      Alert.alert("Polubienie", "Nie uda\u0142o si\u0119 usun\u0105\u0107 oczekuj\u0105cego polubienia. Spr\u00f3buj ponownie.");
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
      setMessageDraft("");
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
      let photoCleanupPending = false;
      try {
        await deleteProfilePhotos(appUser.uid, profilePhotos);
      } catch {
        photoCleanupPending = true;
      }
      await deleteCurrentUserAccount();

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
      Alert.alert("Konto usuni\u0119te", photoCleanupPending ? "Konto zosta\u0142o usuni\u0119te. \u017b\u0105danie usuni\u0119cia pozosta\u0142ych plik\u00f3w zosta\u0142o zapisane." : "Konto i powi\u0105zane dane zosta\u0142y usuni\u0119te.");
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

  if (!onboarded) {
    return (
      <ScreenFrame contentPadding={contentPadding}>
        <OnboardingScreen
          intent={intent}
          setIntent={setIntent}
          profileNameMode={profileNameMode}
          setProfileNameMode={setProfileNameMode}
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
          nickname={nickname}
          setNickname={setNickname}
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
    <LinearGradient colors={["#050507", "#150711", "#050507"]} style={styles.root}>
      <StatusBar style="light" />
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
            profile={activeProfile}
            nextProfile={nextProfile}
            hasPro={revenueCat.isPro}
            requestProAccess={revenueCat.presentPaywallIfNeeded}
            onSwipe={handleSwipe}
            onPremiumChatRequest={sendPremiumChatRequest}
            onOpenMessages={() => setTab("messages")}
            onOpenMatches={() => setTab("matches")}
            onOpenProfile={() => setTab("profile")}
            onOpenPremium={() => setTab("premium")}
            onOpenSafety={() => setTab("safety")}
            onSignOut={confirmSignOut}
            hasMatchedProfile={hasMatchedActiveProfile}
            hasRequestedProfile={hasRequestedActiveProfile}
            superlikesRemaining={superlikesRemaining}
            selectedInterests={selectedInterests}
            discoverFilters={discoverFilters}
            screenMinHeight={discoverMinHeight}
            onReportProfile={async (reason) => activeProfileKey ? reportProfile(activeProfileKey, reason) : false}
            onRefresh={refreshDiscovery}
            onSavePreferences={saveDiscoveryPreferences}
            onChromeHiddenChange={setBottomNavHidden}
          />
        )}
        {tab === "discover" && !activeProfile && (
          <DiscoverEmptyState
            screenMinHeight={discoverMinHeight}
            likedCount={likedProfileKeys.length}
            loading={profilesLoading}
            error={profileFeedError}
            onRefresh={refreshDiscovery}
            onOpenMatches={() => setTab("matches")}
            onOpenMessages={() => setTab("messages")}
            onOpenProfile={() => setTab("profile")}
            onOpenPremium={() => setTab("premium")}
            onOpenSafety={() => setTab("safety")}
            onSignOut={confirmSignOut}
            discoverFilters={discoverFilters}
            onSavePreferences={saveDiscoveryPreferences}
            onChromeHiddenChange={setBottomNavHidden}
          />
        )}
        {tab === "matches" && (
          <MatchesScreen
            profiles={availableProfiles}
            matchedProfileKeys={matchedProfileKeys}
            likedProfileKeys={likedProfileKeys}
            incomingLikeKinds={incomingLikeKinds}
            chatRequestKeys={chatRequestKeys}
            chatThreads={chatThreads}
            hasPro={revenueCat.isPro}
            viewerInterests={selectedInterests}
            onLikeIncomingProfile={likeIncomingProfile}
            onCancelPendingLike={cancelOutgoingLike}
            onCancelRequest={cancelOutgoingRequest}
            onOpenMessages={() => setTab("messages")}
          />
        )}
        {tab === "messages" && (
          <MessagesScreen
            profiles={availableProfiles}
            matchedProfileKeys={matchedProfileKeys}
            chatRequestKeys={chatRequestKeys}
            chatThreads={chatThreads}
            selectedChatKey={selectedChatKey}
            setSelectedChatKey={setSelectedChatKey}
            messageDraft={messageDraft}
            setMessageDraft={setMessageDraft}
            onSendMessage={sendMessageToProfile}
            onAcceptRequest={acceptRequest}
            onRejectRequest={rejectRequest}
            onBlockProfile={blockProfile}
            onReportProfile={reportProfile}
          />
        )}
        {tab === "premium" && <PremiumScreen premiumPlan={premiumPlan} setPremiumPlan={setPremiumPlan} revenueCat={revenueCat} />}
        {tab === "safety" && <SafetyCenter onBack={() => setTab("profile")} onDeleteAccount={confirmDeleteAccount} />}
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
            birthDate={birthDate}
            intent={intent}
            profileBio={profileBio}
            setProfileBio={setProfileBio}
            onBirthDateChange={(value) => {
              const formatted = formatBirthDateInput(value);
              setBirthDate(formatted);
              const age = calculateAge(formatted);
              if (age !== null) setUserAge(age);
            }}
            discoverFilters={discoverFilters}
            userCity={userCity}
            userCountry={userCountry}
            locationStatus={locationStatus}
            locationBusy={locationBusy}
            onRequestLocation={() => { void updateCurrentLocation(true); }}
            email={email}
            selectedInterests={selectedInterests}
            setSelectedInterests={setSelectedInterests}
            userAge={userAge}
            setUserAge={setUserAge}
            profilePhotos={profilePhotos}
            setProfilePhotos={setProfilePhotos}
            privateProfile={privateProfile}
            setPrivateProfile={setPrivateProfile}
            profileName={profileName}
            premiumPlan={premiumPlan}
            hasPro={revenueCat.isPro}
            openPremium={() => setTab("premium")}
            openCustomerCenter={revenueCat.openCustomerCenter}
            openSafety={() => setTab("safety")}
            onSave={saveProfileToFirestore}
          />
        )}
        <SparkAdBanner enabled={showCurrentBanner && tab !== "discover"} placement={tab} />
      </ScrollView>
      <MatchCelebration
        profile={matchCelebrationProfile}
        onContinue={() => setMatchCelebrationProfile(null)}
        onOpenChat={() => {
          setMatchCelebrationProfile(null);
          setTab("messages");
        }}
      />
      {!bottomNavHidden && (
        <BlurView intensity={84} tint="dark" style={[styles.bottomNav, { bottom: Math.max(insets.bottom - 2, 6) }]}>
        {[
          ["discover", "Odkryj", "cards-heart"],
          ["matches", "Matche", "heart-multiple"],
          ["messages", "Wiadomości", "message-text"],
          ["premium", "Pro", "crown"],
          ["profile", "Profil", "account-circle"]
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
            <MaterialCommunityIcons name={icon as any} size={22} color={tab === key ? colors.primary : colors.muted} />
            <Text style={[styles.navText, tab === key && styles.navTextActive]}>{label}</Text>
          </Pressable>
        ))}
        </BlurView>
      )}
    </LinearGradient>
  );
}

function AnimatedBackground() {
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
  return (
    <LinearGradient colors={["#020203", "#080307", "#050507"]} style={styles.root}>
      <AnimatedBackground />
      <StatusBar style="light" />
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
        {authMode === "login" && (
          <Pressable accessibilityRole="button" disabled={authBusy} onPress={onForgotPassword} style={styles.forgotPasswordButton}>
            <Text style={styles.forgotPasswordText}>Nie pamiętasz hasła?</Text>
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
  const place = [city, country].filter(Boolean).join(", ");
  const label = busy ? "Pobieranie lokalizacji..." : place ? "Od\u015bwie\u017c lokalizacj\u0119" : status === "denied" ? "W\u0142\u0105cz lokalizacj\u0119 w ustawieniach" : "U\u017cyj mojej lokalizacji";

  return (
    <View style={styles.locationControl}>
      {place ? <View style={styles.locationStatus}><MaterialCommunityIcons name="map-marker" size={16} color={colors.green} /><Text style={styles.locationStatusText}>{place}</Text></View> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={({ pressed }) => [styles.locationAction, busy && styles.primaryButtonDisabled, pressed && styles.controlPressed]}>
        {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="crosshairs-gps" size={18} color={colors.primary} />}
        <Text style={styles.locationActionText}>{label}</Text>
      </Pressable>
      <Text style={styles.locationPrivacyText}>Opcjonalne. Publicznie pokazujemy tylko przybli\u017con\u0105 odleg\u0142o\u015b\u0107 oraz miasto lub kraj.</Text>
    </View>
  );
}

function ProfileBioInput({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  const remaining = 300 - value.length;
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.profileBioHeader}>
        <Text style={styles.fieldLabel}>Opis profilu</Text>
        <Text style={styles.profileBioCounter}>{remaining} znak\u00f3w</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.slice(0, 300))}
        multiline
        maxLength={300}
        textAlignVertical="top"
        placeholder="Napisz kilka zda\u0144 o sobie, swoich pasjach i osobach, kt\u00f3re chcesz pozna\u0107."
        placeholderTextColor={colors.muted}
        selectionColor="rgba(255,45,141,0.35)"
        cursorColor={colors.primary}
        style={[styles.fieldInput, styles.profileBioInput]}
      />
      <Text style={styles.profileBioHint}>{value.trim().length < 20 ? "Minimum 20 znak\u00f3w" : "Opis b\u0119dzie widoczny na Twojej karcie"}</Text>
    </View>
  );
}

function OnboardingScreen({
  intent, setIntent, profileNameMode, setProfileNameMode, firstName, setFirstName, lastName, setLastName,
  nickname, setNickname, birthDate, onBirthDateChange, profileBio, setProfileBio, profilePhotos, setProfilePhotos,
  discoverFilters, setDiscoverFilters, userCity, userCountry, locationStatus, locationBusy, onRequestLocation, selectedInterests, setSelectedInterests,
  canContinue, onContinue
}: {
  intent: string; setIntent: (value: string) => void;
  profileNameMode: ProfileNameMode; setProfileNameMode: (value: ProfileNameMode) => void;
  firstName: string; setFirstName: (value: string) => void; lastName: string; setLastName: (value: string) => void;
  nickname: string; setNickname: (value: string) => void; birthDate: string; onBirthDateChange: (value: string) => void;
  profileBio: string; setProfileBio: (value: string) => void;
  profilePhotos: ProfilePhoto[]; setProfilePhotos: (value: ProfilePhoto[]) => void;
  discoverFilters: DiscoverFilters; setDiscoverFilters: React.Dispatch<React.SetStateAction<DiscoverFilters>>;
  userCity: string; userCountry: string; locationStatus: "idle" | "granted" | "denied"; locationBusy: boolean; onRequestLocation: () => void; selectedInterests: string[]; setSelectedInterests: (value: string[]) => void;
  canContinue: boolean; onContinue: () => void;
}) {
  const [selectedIntent, setSelectedIntent] = useState(intent);
  const derivedAge = calculateAge(birthDate);

  function selectIntent(label: string) {
    setSelectedIntent(label);
    setIntent(label);
  }

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
        <View style={styles.segmentedChoice}>
          <Pressable onPress={() => setProfileNameMode("realName")} style={[styles.segmentedChoiceItem, profileNameMode === "realName" && styles.segmentedChoiceItemActive]}><Text style={[styles.segmentedChoiceText, profileNameMode === "realName" && styles.segmentedChoiceTextActive]}>Imię i nazwisko</Text></Pressable>
          <Pressable onPress={() => setProfileNameMode("nickname")} style={[styles.segmentedChoiceItem, profileNameMode === "nickname" && styles.segmentedChoiceItemActive]}><Text style={[styles.segmentedChoiceText, profileNameMode === "nickname" && styles.segmentedChoiceTextActive]}>Nick</Text></Pressable>
        </View>
        {profileNameMode === "realName" ? <View style={styles.nameRow}><TextField label="Imię" value={firstName} onChangeText={setFirstName} /><TextField label="Nazwisko (opcjonalnie)" value={lastName} onChangeText={setLastName} /></View> : <TextField label="Nick" value={nickname} onChangeText={setNickname} />}
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
                    accessibilityLabel="Usu\u0144 zdj\u0119cie"
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
        <View style={styles.intentList}>
          {[["Randki", "Chemia, rozmowy, spotkania", "heart-outline"], ["Znajomi", "Kawa, planszówki, miasto", "coffee-outline"], ["LGBT+ / Społeczność", "Grupy, wydarzenia, znajomości", "account-group-outline"]].map(([label, description, icon]) => {
            const active = selectedIntent === label;
            return <Pressable key={label} onPress={() => selectIntent(label)} style={[styles.intentCard, active && styles.intentCardActive]}><View style={styles.intentIcon}><MaterialCommunityIcons name={active ? "check-bold" : icon as any} size={25} color={colors.primaryDeep} /></View><View style={styles.fill}><Text style={styles.intentTitle}>{label}</Text><Text style={styles.intentDescription}>{description}</Text></View></Pressable>;
          })}
        </View>
        <Text style={styles.fieldLabel}>Preferowany wiek</Text>
        <AgeRangeControl min={discoverFilters.ageMin} max={discoverFilters.ageMax} onChange={(ageMin, ageMax) => setDiscoverFilters((current) => ({ ...current, ageMin, ageMax }))} />
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
  profile,
  nextProfile,
  hasPro,
  requestProAccess,
  onSwipe,
  onPremiumChatRequest,
  onOpenMessages,
  onOpenMatches,
  onOpenProfile,
  onOpenPremium,
  onOpenSafety,
  onSignOut,
  hasMatchedProfile,
  hasRequestedProfile,
  superlikesRemaining,
  selectedInterests,
  discoverFilters,
  screenMinHeight,
  onReportProfile,
  onRefresh,
  onSavePreferences,
  onChromeHiddenChange
}: {
  profile: MatchProfile;
  nextProfile: MatchProfile | null;
  hasPro: boolean;
  requestProAccess: () => Promise<boolean>;
  onSwipe: (action: SwipeAction) => Promise<SwipeOutcome>;
  onPremiumChatRequest: () => void;
  onOpenMessages: () => void;
  onOpenMatches: () => void;
  onOpenProfile: () => void;
  onOpenPremium: () => void;
  onOpenSafety: () => void;
  onSignOut: () => void;
  hasMatchedProfile: boolean;
  hasRequestedProfile: boolean;
  superlikesRemaining: number;
  selectedInterests: string[];
  discoverFilters: DiscoverFilters;
  screenMinHeight: number;
  onReportProfile: (reason?: string) => Promise<boolean>;
  onRefresh: () => void;
  onSavePreferences: (nextFilters: DiscoverFilters) => Promise<boolean>;
  onChromeHiddenChange?: (hidden: boolean) => void;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [swipeBusy, setSwipeBusy] = useState(false);
  const [swipeFeedback, setSwipeFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeMotion = useRef(new Animated.Value(0)).current;
  const { width: viewportWidth } = useWindowDimensions();
  const profileKey = getProfileKey(profile);
  const premiumChatLabel = hasMatchedProfile ? "Chat" : hasRequestedProfile ? "Czeka" : "Napisz teraz";
  const premiumChatSub = hasMatchedProfile ? "Otwórz" : hasRequestedProfile ? "Wysłana" : "Pro";
  const preferenceSummary = [
    { icon: "map-marker-radius", text: `${discoverFilters.maxDistanceKm} km` },
    { icon: "calendar-range", text: `${discoverFilters.ageMin}–${discoverFilters.ageMax}` },
    { icon: "tag-heart", text: discoverFilters.targetInterests.length ? `${discoverFilters.targetInterests.length} tematów` : "Dowolne" }
  ];
  const swipeRotate = swipeMotion.interpolate({ inputRange: [-420, 0, 420], outputRange: ["-12deg", "0deg", "12deg"] });
  const swipeOpacity = swipeMotion.interpolate({ inputRange: [-420, 0, 420], outputRange: [0.24, 1, 0.24] });
  const swipeScale = swipeMotion.interpolate({ inputRange: [-420, 0, 420], outputRange: [0.96, 1, 0.96] });
  const passLabelOpacity = swipeMotion.interpolate({ inputRange: [-260, -80, 0], outputRange: [1, 0.55, 0], extrapolate: "clamp" });
  const matchLabelOpacity = swipeMotion.interpolate({ inputRange: [0, 80, 260], outputRange: [0, 0.55, 1], extrapolate: "clamp" });
  const overlayOpen = previewOpen || preferencesOpen || reportOpen || menuOpen;
  const availableCardHeight = Math.max(210, screenMinHeight - 202);
  const feedCardWidth = Math.max(168, Math.min(viewportWidth - 20, availableCardHeight * 0.8, 428));
  const feedCardHeight = feedCardWidth * 1.25;

  useEffect(() => {
    onChromeHiddenChange?.(overlayOpen);
    return () => onChromeHiddenChange?.(false);
  }, [onChromeHiddenChange, overlayOpen]);

  useEffect(() => {
    swipeMotion.setValue(0);
    setSwipeBusy(false);
  }, [profileKey, swipeMotion]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  async function runProAction(action: () => void | Promise<void>, locked: boolean) {
    if (locked) {
      const granted = await requestProAccess();
      if (!granted) {
        return;
      }
    }

    await action();
  }

  async function runSwipeAction(action: SwipeAction) {
    if (swipeBusy) {
      return;
    }

    setSwipeBusy(true);
    const direction = action === "pass" ? -1 : 1;
    Animated.timing(swipeMotion, {
      toValue: direction * 460,
      duration: 230,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (!finished) {
        swipeMotion.setValue(0);
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
                  ? "To match!"
                  : null;

          if (feedback) {
            setSwipeFeedback(feedback);
            if (feedbackTimer.current) {
              clearTimeout(feedbackTimer.current);
            }
            feedbackTimer.current = setTimeout(() => setSwipeFeedback(null), 1500);
          }
        } finally {
          swipeMotion.setValue(0);
          setSwipeBusy(false);
        }
      })();
    });
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !swipeBusy && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderMove: (_, gesture) => {
          swipeMotion.setValue(gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldCommit = Math.abs(gesture.dx) > 96 || Math.abs(gesture.vx) > 0.55;

          if (shouldCommit) {
            void runSwipeAction(gesture.dx < 0 ? "pass" : "like");
            return;
          }

          Animated.spring(swipeMotion, {
            toValue: 0,
            speed: 20,
            bounciness: 7,
            useNativeDriver: true
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeMotion, {
            toValue: 0,
            speed: 20,
            bounciness: 7,
            useNativeDriver: true
          }).start();
        }
      }),
    [profileKey, swipeBusy, swipeMotion]
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

    await runProAction(action, locked);
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
      <TopBar eyebrow="Odkrywaj" title="Dla Ciebie" left="=" right="tune-variant" onLeftPress={() => setMenuOpen(true)} onRightPress={() => setPreferencesOpen(true)} />
      <Pressable accessibilityRole="button" onPress={() => setPreferencesOpen(true)} style={styles.discoverSummaryBar}>
        {preferenceSummary.map((item, index) => (
          <View key={item.text} style={[styles.discoverSummaryPill, index > 0 && styles.discoverSummaryPillDivider]}>
            <MaterialCommunityIcons name={item.icon as any} size={14} color={colors.primary} />
            <Text style={styles.discoverSummaryText} numberOfLines={1} selectable>{item.text}</Text>
          </View>
        ))}
      </Pressable>

      <View style={styles.stitchMainCanvas}>
        <View style={[styles.feedCardDeck, { width: feedCardWidth, height: feedCardHeight }]}>
          {nextProfile && (
            <View pointerEvents="none" style={styles.nextProfileCard}>
              <ProfileCard profile={nextProfile} compact />
            </View>
          )}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.swipeCardMotion,
              { opacity: swipeOpacity, transform: [{ translateX: swipeMotion }, { rotate: swipeRotate }, { scale: swipeScale }] }
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Profil " + profile.name}
              accessibilityHint="Przesuń w lewo, aby pominąć, lub w prawo, aby polubić."
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
              onPress={() => setPreviewOpen(true)}
              style={styles.feedProfilePressable}
            >
              <ProfileCard profile={profile} onReport={() => setReportOpen(true)} />
            </Pressable>
            <Animated.View pointerEvents="none" style={[styles.swipeCue, styles.swipeCueLeft, { opacity: passLabelOpacity }]}>
              <Text style={styles.swipeCueText}>POMIŃ</Text>
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.swipeCue, styles.swipeCueRight, styles.swipeCueLike, { opacity: matchLabelOpacity }]}>
              <Text style={[styles.swipeCueText, styles.swipeCueTextLike]}>LUBIĘ</Text>
            </Animated.View>
          </Animated.View>

          {swipeFeedback && (
            <View pointerEvents="none" style={styles.swipeFeedback}>
              <MaterialCommunityIcons name="check-circle" size={17} color="#fff" />
              <Text style={styles.swipeFeedbackText}>{swipeFeedback}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.stitchBottomPanel}>
        <View style={styles.stitchFabDock} pointerEvents="box-none">
          <SwipeFab label="Szczegóły" icon="account" small onPress={() => setPreviewOpen(true)} />
          <SwipeFab label="SPARKLIKE" sublabel={`${superlikesRemaining}/10`} icon="fire" primary large locked={!hasPro} onPress={() => promptProFeature("superlike", () => runSwipeAction("superlike"), !hasPro)} />
          <SwipeFab label={premiumChatLabel} sublabel={premiumChatSub} icon="chat" small locked={!hasPro && !hasMatchedProfile} onPress={() => promptProFeature("message", handlePremiumChat, !hasPro && !hasMatchedProfile)} />

        </View>
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
        onOpenProfile={onOpenProfile}
        onOpenPremium={onOpenPremium}
        onOpenSafety={onOpenSafety}
        onSignOut={onSignOut}
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
                <Text style={styles.reportSubtitle} selectable>{profile.name} {profile.surname} - zg\u0142oszenie trafi bezpo\u015brednio do moderacji</Text>
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
function AgeRangeControl({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  function adjust(side: "min" | "max", delta: number) {
    if (side === "min") onChange(Math.max(18, Math.min(max, min + delta)), max);
    else onChange(min, Math.min(99, Math.max(min, max + delta)));
  }

  return (
    <View style={styles.ageRangeGrid}>
      {([["Od", "min", min], ["Do", "max", max]] as const).map(([label, side, value]) => (
        <View key={side} style={styles.ageRangeSide}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View style={styles.ageRangeButtons}>
            <Pressable onPress={() => adjust(side, -1)} style={styles.ageRangeButton}><MaterialCommunityIcons name="minus" size={18} color={colors.ink} /></Pressable>
            <Text style={styles.ageRangeValue}>{value}</Text>
            <Pressable onPress={() => adjust(side, 1)} style={styles.ageRangeButton}><MaterialCommunityIcons name="plus" size={18} color={colors.ink} /></Pressable>
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
    filters.proOnly
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
  onOpenProfile,
  onOpenPremium,
  onOpenSafety,
  onSignOut
}: {
  visible: boolean;
  filters: DiscoverFilters;
  onClose: () => void;
  onOpenPreferences: () => void;
  onRefresh: () => void;
  onOpenMatches: () => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  onOpenPremium: () => void;
  onOpenSafety: () => void;
  onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const activeFilters = countActiveDiscoverFilters(filters);
  const menuItems = [
    { icon: "cards-heart", label: "Odkrywaj", hint: "Wróć do kart", active: true, action: onClose },
    { icon: "heart-multiple", label: "Matche", hint: "Polubienia i nowe iskry", action: onOpenMatches },
    { icon: "message-text", label: "Wiadomości", hint: "Aktywne i oczekujące", action: onOpenMessages },
    { icon: "account-circle", label: "Twój profil", hint: "Zdjęcia, dane i zainteresowania", action: onOpenProfile },
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
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<DiscoverFilters>(() => ({ ...filters, targetInterests: [...filters.targetInterests] }));
  const [saving, setSaving] = useState(false);
  const activeFilters = countActiveDiscoverFilters(draft);
  const distanceOptions = [25, 50, 100, 250, 500];

  useEffect(() => {
    if (visible) {
      setDraft({ ...filters, targetInterests: [...filters.targetInterests] });
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

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={[styles.discoveryModalRoot, styles.discoveryFilterModalRoot, { paddingTop: Math.max(insets.top + 4, 12) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zamknij preferencje" onPress={onClose} style={styles.discoveryModalBackdrop} />
        <View style={[styles.discoveryFilterSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.discoverySheetHandle} />
          <View style={styles.discoveryFilterHeader}>
            <View style={styles.fill}>
              <Text style={styles.discoveryFilterEyebrow}>DOPASUJ FEED</Text>
              <Text style={styles.discoveryFilterTitle}>Kogo chcesz poznać?</Text>
              <Text style={styles.discoveryFilterSubtitle}>Zmiany zobaczysz dopiero po ich zastosowaniu.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Zamknij preferencje" onPress={onClose} style={styles.discoveryDrawerClose}>
              <MaterialCommunityIcons name="close" size={21} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.discoveryFilterScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.discoveryFilterSection}>
              <View style={styles.discoveryFilterSectionHeader}>
                <View style={styles.discoveryFilterSectionIcon}><MaterialCommunityIcons name="calendar-range" size={19} color={colors.primary} /></View>
                <View style={styles.fill}><Text style={styles.discoveryFilterSectionTitle}>Przedział wieku</Text><Text style={styles.discoveryFilterSectionHint}>Wybierz osobno dolną i górną granicę.</Text></View>
              </View>
              <AgeRangeControl min={draft.ageMin} max={draft.ageMax} onChange={(ageMin, ageMax) => setDraft((current) => ({ ...current, ageMin, ageMax }))} />
            </View>

            <View style={styles.discoveryFilterSection}>
              <View style={styles.discoveryFilterSectionHeader}>
                <View style={styles.discoveryFilterSectionIcon}><MaterialCommunityIcons name="map-marker-radius" size={19} color={colors.primary} /></View>
                <View style={styles.fill}><Text style={styles.discoveryFilterSectionTitle}>Maksymalna odległość</Text><Text style={styles.discoveryFilterSectionHint}>Sam decydujesz, czy pokazać profile bez dokładnego dystansu.</Text></View>
              </View>
              <View style={styles.discoveryDistanceGrid}>
                {distanceOptions.map((distance) => {
                  const selected = draft.maxDistanceKm === distance;
                  return (
                    <Pressable key={distance} accessibilityRole="button" onPress={() => setDraft((current) => ({ ...current, maxDistanceKm: distance }))} style={({ pressed }) => [styles.discoveryDistanceOption, selected && styles.discoveryDistanceOptionActive, pressed && styles.controlPressed]}>
                      <Text style={[styles.discoveryDistanceText, selected && styles.discoveryDistanceTextActive]}>{distance === 500 ? "Cały kraj" : `${distance} km`}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: draft.includeProfilesWithoutLocation }} onPress={() => setDraft((current) => ({ ...current, includeProfilesWithoutLocation: !current.includeProfilesWithoutLocation }))} style={({ pressed }) => [styles.discoveryFilterToggleRow, pressed && styles.controlPressed]}>
                <View style={styles.fill}><Text style={styles.discoveryFilterToggleTitle}>Uwzględniaj profile bez lokalizacji</Text><Text style={styles.discoveryFilterToggleHint}>Wyłącz, jeśli limit kilometrów ma być bezwzględny.</Text></View>
                <Switch pointerEvents="none" value={draft.includeProfilesWithoutLocation} trackColor={{ false: "rgba(255,255,255,0.12)", true: colors.primary }} thumbColor="#fff" />
              </Pressable>
            </View>

            <View style={styles.discoveryFilterSection}>
              <View style={styles.discoveryFilterSectionHeader}>
                <View style={styles.discoveryFilterSectionIcon}><MaterialCommunityIcons name="tune-vertical" size={19} color={colors.primary} /></View>
                <View style={styles.fill}><Text style={styles.discoveryFilterSectionTitle}>Sposób dopasowania</Text><Text style={styles.discoveryFilterSectionHint}>Opcjonalne filtry zawężające wyniki.</Text></View>
              </View>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: draft.requireCommonInterests }} onPress={() => setDraft((current) => ({ ...current, requireCommonInterests: !current.requireCommonInterests }))} style={({ pressed }) => [styles.discoveryFilterToggleRow, pressed && styles.controlPressed]}>
                <View style={styles.fill}><Text style={styles.discoveryFilterToggleTitle}>Wymagaj wspólnego zainteresowania</Text><Text style={styles.discoveryFilterToggleHint}>Pokaż osoby z przynajmniej jednym wspólnym tagiem.</Text></View>
                <Switch pointerEvents="none" value={draft.requireCommonInterests} trackColor={{ false: "rgba(255,255,255,0.12)", true: colors.primary }} thumbColor="#fff" />
              </Pressable>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: draft.proOnly }} onPress={() => setDraft((current) => ({ ...current, proOnly: !current.proOnly }))} style={({ pressed }) => [styles.discoveryFilterToggleRow, pressed && styles.controlPressed]}>
                <View style={styles.fill}><Text style={styles.discoveryFilterToggleTitle}>Tylko profile Spark Pro</Text><Text style={styles.discoveryFilterToggleHint}>Zawęź feed do aktywnych kont premium.</Text></View>
                <Switch pointerEvents="none" value={draft.proOnly} trackColor={{ false: "rgba(255,255,255,0.12)", true: colors.primary }} thumbColor="#fff" />
              </Pressable>
            </View>

            <View style={styles.discoveryFilterSection}>
              <View style={styles.discoveryFilterSectionHeader}>
                <View style={styles.discoveryFilterSectionIcon}><MaterialCommunityIcons name="tag-heart" size={19} color={colors.primary} /></View>
                <View style={styles.fill}><Text style={styles.discoveryFilterSectionTitle}>Szukane zainteresowania</Text><Text style={styles.discoveryFilterSectionHint}>{draft.targetInterests.length ? `${draft.targetInterests.length}/10 wybranych` : "Opcjonalne. Zacznij od popularnych tematów."}</Text></View>
              </View>
              <CategorizedInterestPicker selected={draft.targetInterests} onToggle={(item) => setDraft((current) => ({ ...current, targetInterests: toggleListItem(current.targetInterests, item) }))} maxSelected={10} />
            </View>
          </ScrollView>

          <View style={styles.discoveryFilterFooter}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => setDraft(createDefaultDiscoverFilters())} style={({ pressed }) => [styles.discoveryResetButton, pressed && styles.controlPressed]}>
              <MaterialCommunityIcons name="backup-restore" size={18} color={colors.ink} />
              <Text style={styles.discoveryResetText}>Resetuj</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void applyFilters()} style={({ pressed }) => [styles.discoveryApplyButton, saving && styles.primaryButtonDisabled, pressed && styles.controlPressed]}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="check" size={19} color="#fff" />}
              <Text style={styles.discoveryApplyText}>{saving ? "Zapisywanie" : activeFilters ? `Pokaż profile (${activeFilters})` : "Pokaż profile"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ProfileCard({ profile, onReport, compact = false }: { profile: MatchProfile; onReport?: () => void; compact?: boolean }) {
  const featuredInterests = getFeaturedInterests(profile);
  const displayName = [profile.name, profile.surname].filter(Boolean).join(" ");
  const interestMatchPercent = Math.max(0, Math.min(100, profile.interestMatchPercent ?? 0));

  return (
    <View style={[styles.profileCard, compact && styles.profileCardCompact]}>
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
        <View style={styles.profileStatusRow}>
          {profile.premium && (
            <View style={styles.cardProBadge}>
              <MaterialCommunityIcons name="crown" size={12} color="#3a2500" />
              <Text style={styles.cardProText} maxFontSizeMultiplier={1.15}>SPARK PRO</Text>
            </View>
          )}
          <Text style={styles.matchInlinePill} maxFontSizeMultiplier={1.15}>{interestMatchPercent}% zgodności</Text>
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
        <View style={styles.featuredInterestRow}>
          {featuredInterests.map((interest, index) => {
            const theme = getInterestTheme(interest, index);
            return (
              <View key={interest} style={[styles.featuredInterestPill, { backgroundColor: theme.soft, borderColor: theme.border }]}>
                <MaterialCommunityIcons name="star-four-points" size={12} color={theme.active} />
                <Text style={styles.featuredInterestText} numberOfLines={1} maxFontSizeMultiplier={1.15}>{interest}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.cardBio} numberOfLines={compact ? 1 : 2} maxFontSizeMultiplier={1.2}>{profile.bio}</Text>
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
  isOwnProfile = false,
  isPrivateProfile = false,
  readOnly = false
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
  isOwnProfile?: boolean;
  isPrivateProfile?: boolean;
  readOnly?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [bioExpanded, setBioExpanded] = useState(false);
  const photos = getProfileGallery(profile);
  const featuredInterests = getFeaturedInterests(profile);
  const visibleInterests = profile.interests.slice(0, 8);
  const sharedInterests = profile.interests.filter((interest) => viewerInterests.includes(interest));
  const overlapBase = Math.max(1, Math.min(viewerInterests.length, profile.interests.length));
  const calculatedInterestMatch = viewerInterests.length > 0 ? Math.round((sharedInterests.length / overlapBase) * 100) : 0;
  const interestMatchPercent = Math.max(0, Math.min(100, profile.interestMatchPercent ?? calculatedInterestMatch));
  const hasInterestMatch = viewerInterests.length > 0 || typeof profile.interestMatchPercent === "number";
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
  const local = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#050507" },
    header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 9, backgroundColor: "rgba(5,5,7,0.88)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
    headerTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
    headerButton: { width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
    content: { gap: 16, paddingHorizontal: 12 },
    gallery: { position: "relative", alignSelf: "center", overflow: "hidden", borderRadius: 24, backgroundColor: "#111", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", boxShadow: "0 20px 52px rgba(0,0,0,0.46)" },
    photoCounter: { position: "absolute", top: 13, right: 13, minHeight: 30, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(5,5,7,0.76)" },
    photoCounterText: { color: "#fff", fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] },
    dots: { position: "absolute", left: 0, right: 0, bottom: 14, flexDirection: "row", justifyContent: "center", gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.42)" },
    dotActive: { width: 18, backgroundColor: colors.primary },
    identity: { gap: 8, paddingHorizontal: 4 },
    statusRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
    statusBadge: { minHeight: 29, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(66,217,130,0.12)", borderWidth: 1, borderColor: "rgba(66,217,130,0.3)" },
    statusBadgePro: { backgroundColor: "rgba(255,189,89,0.13)", borderColor: "rgba(255,189,89,0.34)" },
    statusBadgeMatch: { backgroundColor: colors.primarySoft, borderColor: "rgba(255,45,141,0.25)" },
    statusText: { color: colors.green, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
    statusTextPro: { color: colors.gold },
    statusTextMatch: { color: colors.primary },
    title: { color: colors.ink, fontSize: compactScreen ? 24 : 27, lineHeight: compactScreen ? 29 : 33, fontWeight: "900" },
    subtitle: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    subtitleText: { color: "#e4bdc3", fontSize: 12, lineHeight: 17, fontWeight: "800" },
    featuredPanel: { gap: 9, padding: 13, borderRadius: 18, backgroundColor: "rgba(255,45,141,0.07)", borderWidth: 1, borderColor: "rgba(255,45,141,0.17)" },
    featuredLabel: { color: colors.primaryDeep, fontSize: 9, letterSpacing: 0.6, fontWeight: "900" },
    featuredRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    featuredChip: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
    featuredChipText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
    metrics: { flexDirection: "row", gap: 7 },
    metric: { flex: 1, minWidth: 0, minHeight: 76, gap: 4, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.075)" },
    metricValue: { color: colors.primary, fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] },
    metricValueCompact: { color: colors.ink, fontSize: 11, lineHeight: 14, textAlign: "center", fontWeight: "900" },
    metricLabel: { color: colors.muted, fontSize: 9, lineHeight: 12, textAlign: "center", fontWeight: "800" },
    section: { gap: 9, paddingHorizontal: 4 },
    sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
    sectionHint: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "700" },
    bio: { color: "#ecd8e1", fontSize: 14, lineHeight: 21, fontWeight: "600" },
    bioToggle: { alignSelf: "flex-start", minHeight: 30, justifyContent: "center", paddingRight: 12 },
    bioToggleText: { color: colors.primary, fontSize: 11, fontWeight: "900" },
    interestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    interestCard: { width: "48%", flexGrow: 1, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1 },
    interestIcon: { width: 27, height: 27, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    interestText: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 11, fontWeight: "900" },
    moreInterests: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    socialList: { gap: 8 },
    social: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.075)" },
    socialIcon: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,45,141,0.1)" },
    socialLabel: { color: colors.ink, fontSize: 12, fontWeight: "900" },
    socialValue: { marginTop: 2, color: colors.muted, fontSize: 11, fontWeight: "800" },
    actions: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 92, flexDirection: "row", alignItems: "stretch", gap: 8, paddingHorizontal: 10, paddingTop: 9, backgroundColor: "rgba(5,5,7,0.96)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
    actionSecondary: { flex: 1, minWidth: 0, minHeight: 58, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 4, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
    actionPrimary: { flex: 1.25, minWidth: 0, minHeight: 58, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 5, borderRadius: 17, backgroundColor: colors.primary, boxShadow: "0 10px 28px rgba(255,45,141,0.3)" },
    actionLabel: { color: colors.ink, fontSize: 10, lineHeight: 13, textAlign: "center", fontWeight: "900" },
    actionLabelPrimary: { color: "#fff", fontSize: 11 },
    actionMetaRow: { minHeight: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
    actionMeta: { color: colors.muted, fontSize: 8, lineHeight: 10, textAlign: "center", fontWeight: "800" },
    actionMetaPrimary: { color: "rgba(255,255,255,0.78)" }
  });

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <LinearGradient colors={["#050507", "#13070f", "#050507"]} style={local.root}>
        <StatusBar style="light" />
        <View style={[local.header, { paddingTop: Math.max(insets.top, 10) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zamknij profil" onPress={onClose} style={local.headerButton}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.ink} />
          </Pressable>
          <Text style={local.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.15}>{isOwnProfile ? "Podgląd Twojej karty" : displayName}</Text>
          <View style={local.headerButton}>
            <MaterialCommunityIcons name={isOwnProfile ? "eye" : profile.premium ? "crown" : "account-circle"} size={21} color={profile.premium ? colors.gold : colors.green} />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[
            local.content,
            { paddingTop: Math.max(insets.top, 10) + 62, paddingBottom: Math.max(insets.bottom, 10) + (isOwnProfile || readOnly ? 24 : 108) }
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
                <Image key={index} source={photo} style={{ width: photoWidth, aspectRatio: 4 / 5, backgroundColor: "#111" }} contentFit="contain" transition={180} />
              ))}
            </ScrollView>
            <View style={local.photoCounter}>
              <Text style={local.photoCounterText}>{photoIndex + 1}/{photos.length}</Text>
            </View>
            <View style={local.dots}>
              {photos.map((_, index) => <View key={index} style={[local.dot, index === photoIndex && local.dotActive]} />)}
            </View>
          </View>

          <View style={local.identity}>
            <View style={local.statusRow}>
              <View style={local.statusBadge}>
                <MaterialCommunityIcons name={isPrivateProfile ? "lock" : "earth"} size={12} color={colors.green} />
                <Text style={local.statusText}>{isPrivateProfile ? "Profil prywatny" : "Profil publiczny"}</Text>
              </View>
              {profile.premium && (
                <View style={[local.statusBadge, local.statusBadgePro]}>
                  <MaterialCommunityIcons name="crown" size={12} color={colors.gold} />
                  <Text style={[local.statusText, local.statusTextPro]}>Spark Pro</Text>
                </View>
              )}
              {!isOwnProfile && hasInterestMatch && (
                <View style={[local.statusBadge, local.statusBadgeMatch]}>
                  <MaterialCommunityIcons name="tag-heart" size={12} color={colors.primary} />
                  <Text style={[local.statusText, local.statusTextMatch]}>{interestMatchPercent}% zainteresowań</Text>
                </View>
              )}
            </View>
            <Text
              style={local.title}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              maxFontSizeMultiplier={1.15}
            >
              {displayName}, {profile.age}
            </Text>
            <View style={local.subtitle}>
              <MaterialCommunityIcons name="map-marker" size={16} color={colors.primary} />
              <Text style={local.subtitleText} maxFontSizeMultiplier={1.2}>{locationLabel || "Lokalizacja ukryta"}</Text>
              {secondaryDistance && <Text style={local.subtitleText}>• {secondaryDistance}</Text>}
              {profile.heightCm && <Text style={local.subtitleText}>• {profile.heightCm} cm</Text>}
            </View>
          </View>

          <View style={local.featuredPanel}>
            <Text style={local.featuredLabel}>WYRÓŻNIONE ZAINTERESOWANIA</Text>
            <View style={local.featuredRow}>
              {featuredInterests.map((interest, index) => {
                const theme = getInterestTheme(interest, index);
                return (
                  <View key={interest} style={[local.featuredChip, { backgroundColor: theme.soft, borderColor: theme.border }]}>
                    <MaterialCommunityIcons name="star-four-points" size={12} color={theme.active} />
                    <Text style={local.featuredChipText} numberOfLines={1} maxFontSizeMultiplier={1.15}>{interest}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {!isOwnProfile && (
            <View style={local.metrics}>
              <View style={local.metric}>
                <MaterialCommunityIcons name="account-heart" size={17} color={colors.primary} />
                <Text style={local.metricValue} maxFontSizeMultiplier={1.15}>{sharedInterests.length}</Text>
                <Text style={local.metricLabel} maxFontSizeMultiplier={1.15}>wspólne</Text>
              </View>
              <View style={local.metric}>
                <MaterialCommunityIcons name="compass-outline" size={17} color={colors.primary} />
                <Text style={local.metricValueCompact} numberOfLines={2} maxFontSizeMultiplier={1.15}>{profile.intent || "Nowe znajomości"}</Text>
                <Text style={local.metricLabel} maxFontSizeMultiplier={1.15}>cel profilu</Text>
              </View>
              <View style={local.metric}>
                <MaterialCommunityIcons name="map-marker-distance" size={17} color={colors.primary} />
                <Text style={local.metricValueCompact} numberOfLines={2} maxFontSizeMultiplier={1.15}>{distanceFact}</Text>
                <Text style={local.metricLabel} maxFontSizeMultiplier={1.15}>odległość</Text>
              </View>
            </View>
          )}

          <View style={local.section}>
            <Text style={local.sectionTitle}>O mnie</Text>
            <Text style={local.bio} numberOfLines={bioExpanded ? undefined : 3} maxFontSizeMultiplier={1.2}>{profile.bio}</Text>
            {bioNeedsToggle && (
              <Pressable accessibilityRole="button" onPress={() => setBioExpanded((value) => !value)} style={local.bioToggle}>
                <Text style={local.bioToggleText}>{bioExpanded ? "Pokaż mniej" : "Czytaj dalej"}</Text>
              </Pressable>
            )}
          </View>

          <View style={local.section}>
            <Text style={local.sectionTitle}>Zainteresowania</Text>
            <Text style={local.sectionHint}>{isOwnProfile ? "Pierwsze trzy są wyróżnione na karcie." : "Wspólne zainteresowania mają mocniejsze obramowanie."}</Text>
            <View style={local.interestGrid}>
              {visibleInterests.map((interest, index) => {
                const theme = getInterestTheme(interest, index);
                const shared = sharedInterests.includes(interest);
                return (
                  <View
                    key={interest}
                    style={[
                      local.interestCard,
                      {
                        backgroundColor: shared ? "rgba(255,45,141,0.14)" : theme.soft,
                        borderColor: shared ? colors.primary : theme.border
                      }
                    ]}
                  >
                    <View style={[local.interestIcon, { backgroundColor: shared ? colors.primarySoft : theme.soft }]}>
                      <MaterialCommunityIcons name={getInterestIcon(interest, "tag-heart") as any} size={15} color={shared ? colors.primary : theme.active} />
                    </View>
                    <Text style={local.interestText} numberOfLines={2} maxFontSizeMultiplier={1.15}>{interest}</Text>
                  </View>
                );
              })}
            </View>
            {profile.interests.length > visibleInterests.length && (
              <Text style={local.moreInterests}>+{profile.interests.length - visibleInterests.length} pozostałych zainteresowań</Text>
            )}
          </View>

          {profile.socials.length > 0 && (
            <View style={local.section}>
              <Text style={local.sectionTitle}>Social media</Text>
              <Text style={local.sectionHint}>Dane kontaktowe są chronione do momentu matcha.</Text>
              <View style={local.socialList}>
                {profile.socials.map((social) => (
                  <View key={social.label} style={local.social}>
                    <View style={local.socialIcon}><SocialIcon label={social.label} size={17} /></View>
                    <View style={styles.fill}>
                      <Text style={local.socialLabel}>{social.label}</Text>
                      <Text style={local.socialValue}>{canViewSocials ? social.value : "Widoczne po matchu"}</Text>
                    </View>
                    {!canViewSocials && <MaterialCommunityIcons name="lock" size={16} color={colors.muted} />}
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {!isOwnProfile && !readOnly && (
          <View style={[local.actions, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Wyślij SPARKLIKE" onPress={onSuperlike} style={local.actionSecondary}>
              <MaterialCommunityIcons name="fire" size={20} color={colors.primary} />
              <Text style={local.actionLabel} numberOfLines={1} maxFontSizeMultiplier={1.1}>SPARKLIKE</Text>
              <View style={local.actionMetaRow}>
                {superlikeLocked && <MaterialCommunityIcons name="lock" size={9} color={colors.muted} />}
                <Text style={local.actionMeta}>Pro • {superlikesRemaining}/10</Text>
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Polub profil" onPress={onLike} style={local.actionPrimary}>
              <MaterialCommunityIcons name="heart-plus" size={21} color="#fff" />
              <Text style={[local.actionLabel, local.actionLabelPrimary]} numberOfLines={1} maxFontSizeMultiplier={1.1}>Polub profil</Text>
              <Text style={[local.actionMeta, local.actionMetaPrimary]}>Match po wzajemności</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Napisz teraz" onPress={onMessage} style={local.actionSecondary}>
              <MaterialCommunityIcons name="message-text" size={20} color={colors.primary} />
              <Text style={local.actionLabel} numberOfLines={1} maxFontSizeMultiplier={1.1}>Napisz teraz</Text>
              <View style={local.actionMetaRow}>
                {messageLocked && <MaterialCommunityIcons name="lock" size={9} color={colors.muted} />}
                <Text style={local.actionMeta}>{messageLocked ? "Spark Pro" : "Od razu"}</Text>
              </View>
            </Pressable>
          </View>
        )}
      </LinearGradient>
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

function DiscoverEmptyState({
  screenMinHeight,
  likedCount,
  loading,
  error,
  onRefresh,
  onOpenMatches,
  onOpenMessages,
  onOpenProfile,
  onOpenPremium,
  onOpenSafety,
  onSignOut,
  discoverFilters,
  onSavePreferences,
  onChromeHiddenChange
}: {
  screenMinHeight: number;
  likedCount: number;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenMatches: () => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  onOpenPremium: () => void;
  onOpenSafety: () => void;
  onSignOut: () => void;
  discoverFilters: DiscoverFilters;
  onSavePreferences: (nextFilters: DiscoverFilters) => Promise<boolean>;
  onChromeHiddenChange?: (hidden: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const overlayOpen = menuOpen || preferencesOpen;

  useEffect(() => {
    onChromeHiddenChange?.(overlayOpen);
    return () => onChromeHiddenChange?.(false);
  }, [onChromeHiddenChange, overlayOpen]);


  return (
    <View style={[styles.discoverScreen, styles.discoverEmptyScreen, { minHeight: screenMinHeight }]}>
      <TopBar eyebrow="Odkrywaj" title="Dla Ciebie" left="=" right="tune-variant" onLeftPress={() => setMenuOpen(true)} onRightPress={() => setPreferencesOpen(true)} />
      <View style={styles.discoverEmptyBody}>
        <View style={styles.discoverEmptyIcon}>
          {loading ? <ActivityIndicator color={colors.primary} size="large" /> : <MaterialCommunityIcons name="cards-heart-outline" size={38} color={colors.primary} />}
        </View>
        <Text style={styles.discoverEmptyTitle} selectable>{loading ? "Szukamy profili" : error ? "Nie udało się pobrać profili" : "To wszystko na teraz"}</Text>
        <Text style={styles.discoverEmptyText} selectable>
          {loading ? "Dopasowujemy osoby do Twoich zainteresowań i preferencji." : error ? "Sprawdź połączenie i spróbuj odświeżyć listę." : "Nie pokazujemy ponownie profili, które już oceniłeś. Wróć później albo przywróć pominięte karty."}
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
        onOpenProfile={onOpenProfile}
        onOpenPremium={onOpenPremium}
        onOpenSafety={onOpenSafety}
        onSignOut={onSignOut}
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
  onContinue,
  onOpenChat
}: {
  profile: MatchProfile | null;
  onContinue: () => void;
  onOpenChat: () => void;
}) {
  if (!profile) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onContinue}>
      <View style={styles.matchCelebrationBackdrop}>
        <LinearGradient colors={["rgba(44,7,28,0.98)", "rgba(5,5,7,0.99)"]} style={styles.matchCelebrationCard}>
          <View style={styles.matchCelebrationGlow} />
          <View style={styles.matchCelebrationIcon}>
            <MaterialCommunityIcons name="heart-multiple" size={34} color="#fff" />
          </View>
          <Text style={styles.matchCelebrationKicker} selectable>WZAJEMNE POLUBIENIE</Text>
          <Text style={styles.matchCelebrationTitle} selectable>To match!</Text>
          <Text style={styles.matchCelebrationText} selectable>
            Ty i {profile.name} polubiliście się. Rozmowa jest już odblokowana.
          </Text>
          <Image source={profile.image} style={styles.matchCelebrationPhoto} contentFit="cover" />
          <Pressable accessibilityRole="button" onPress={onOpenChat} style={styles.matchCelebrationPrimary}>
            <MaterialCommunityIcons name="message-text" size={20} color="#fff" />
            <Text style={styles.matchCelebrationPrimaryText}>Napisz teraz</Text>
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
  onLikeIncomingProfile,
  onCancelPendingLike,
  onCancelRequest,
  onOpenMessages
}: {
  profiles: MatchProfile[];
  matchedProfileKeys: string[];
  likedProfileKeys: string[];
  incomingLikeKinds: Record<string, "like" | "superlike">;
  chatRequestKeys: string[];
  chatThreads: Record<string, ChatThread>;
  hasPro: boolean;
  viewerInterests: string[];
  onLikeIncomingProfile: (profileKey: string) => Promise<void>;
  onCancelPendingLike: (profileKey: string) => Promise<void>;
  onCancelRequest: (profileKey: string) => Promise<void>;
  onOpenMessages: () => void;
}) {
  const [previewProfile, setPreviewProfile] = useState<MatchProfile | null>(null);
  const matchedProfiles = profiles.filter((profile) => matchedProfileKeys.includes(getProfileKey(profile)));
  const pendingLikes = profiles.filter((profile) => {
    const key = getProfileKey(profile);
    return likedProfileKeys.includes(key) && !matchedProfileKeys.includes(key);
  });
  const incomingLikes = hasPro
    ? profiles.filter((profile) => {
        const key = getProfileKey(profile);
        return Boolean(incomingLikeKinds[key]) && !matchedProfileKeys.includes(key);
      })
    : [];
  const pendingRequests = profiles.filter((profile) => {
    const key = getProfileKey(profile);
    return chatRequestKeys.includes(key) && !matchedProfileKeys.includes(key);
  });
  const isEmpty = matchedProfiles.length === 0 && incomingLikes.length === 0 && pendingLikes.length === 0 && pendingRequests.length === 0;

  return (
    <View style={styles.gapLg}>
      <TopBar eyebrow="Relacje" title="Matche" left="heart-multiple" right="message-text" onRightPress={onOpenMessages} />

      <View style={styles.matchOverview}>
        <View style={styles.matchOverviewItem}><Text style={styles.matchOverviewValue}>{matchedProfiles.length}</Text><Text style={styles.matchOverviewLabel}>aktywnych</Text></View>
        <View style={styles.matchOverviewItem}><Text style={styles.matchOverviewValue}>{incomingLikes.length + pendingLikes.length}</Text><Text style={styles.matchOverviewLabel}>polubienia</Text></View>
        <View style={styles.matchOverviewItem}><Text style={styles.matchOverviewValue}>{pendingRequests.length}</Text><Text style={styles.matchOverviewLabel}>prośby</Text></View>
      </View>

      {isEmpty && (
        <View style={styles.emptyStateCard}>
          <View style={styles.emptyStateIcon}><MaterialCommunityIcons name="heart-outline" size={28} color={colors.primary} /></View>
          <Text style={styles.emptyStateTitle} selectable>Jeszcze bez polubień</Text>
          <Text style={styles.emptyStateText} selectable>Polub profil w Odkrywaj. Gdy druga osoba zrobi to samo, pojawi się tutaj aktywny match.</Text>
        </View>
      )}

      {matchedProfiles.length > 0 && (
        <View style={styles.matchSection}>
          <View style={styles.matchSectionHeader}>
            <Text style={styles.matchSectionTitle} selectable>Aktywne matche</Text>
            <Text style={styles.matchSectionCount}>{matchedProfiles.length}</Text>
          </View>
          <View style={styles.matchGrid}>
            {matchedProfiles.map((profile) => (
              <Pressable key={getProfileKey(profile)} accessibilityRole="button" accessibilityLabel={"Otw\u00f3rz profil " + profile.name} onPress={() => setPreviewProfile(profile)} style={styles.matchCard}>
                <Image source={profile.image} style={styles.matchImage} contentFit="cover" />
                <View style={styles.matchCardCopy}>
                  <Text style={styles.matchName} numberOfLines={1} selectable>{profile.name}, {profile.age}</Text>
                  <Text style={styles.matchSubtitle} numberOfLines={1} selectable>Możecie już pisać</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Napisz do " + profile.name}
                  onPress={(event) => {
                    event.stopPropagation();
                    onOpenMessages();
                  }}
                  style={styles.matchActiveBadge}
                >
                  <MaterialCommunityIcons name="message-text" size={14} color="#fff" />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {incomingLikes.length > 0 && (
        <View style={styles.matchSection}>
          <View style={styles.matchSectionHeader}>
            <View>
              <Text style={styles.matchSectionTitle} selectable>Polubili Cię</Text>
              <Text style={styles.pendingMatchText} selectable>Spark Pro pokazuje osoby gotowe na match.</Text>
            </View>
            <Text style={styles.matchSectionCount}>{incomingLikes.length}</Text>
          </View>
          <View style={styles.pendingMatchList}>
            {incomingLikes.map((profile) => {
              const profileKey = getProfileKey(profile);
              const isSuperlike = incomingLikeKinds[profileKey] === "superlike";
              return (
                <Pressable key={profileKey} accessibilityRole="button" accessibilityLabel={"Otw\u00f3rz profil " + profile.name} onPress={() => setPreviewProfile(profile)} style={styles.pendingMatchRow}>
                  <Image source={profile.image} style={styles.pendingMatchAvatar} contentFit="cover" />
                  <View style={styles.fill}>
                    <Text style={styles.pendingMatchName} selectable>{profile.name}, {profile.age}</Text>
                    <Text style={styles.pendingMatchText} selectable>{isSuperlike ? "Wysłał(a) Ci SparkLike" : "Polubił(a) Twój profil"}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Polub " + profile.name + " i utwórz match"}
                    onPress={(event) => {
                      event.stopPropagation();
                      void onLikeIncomingProfile(profileKey);
                    }}
                    style={styles.incomingLikeButton}
                  >
                    <MaterialCommunityIcons name={isSuperlike ? "fire" : "heart"} size={18} color="#fff" />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {pendingLikes.length > 0 && (
        <View style={styles.matchSection}>
          <View style={styles.matchSectionHeader}>
            <Text style={styles.matchSectionTitle} selectable>Polubione profile</Text>
            <Text style={styles.matchSectionCount}>{pendingLikes.length}</Text>
          </View>
          <View style={styles.pendingMatchList}>
            {pendingLikes.map((profile) => (
              <Pressable key={getProfileKey(profile)} accessibilityRole="button" accessibilityLabel={"Otw\u00f3rz profil " + profile.name} onPress={() => setPreviewProfile(profile)} style={styles.pendingMatchRow}>
                <Image source={profile.image} style={styles.pendingMatchAvatar} contentFit="cover" />
                <View style={styles.fill}>
                  <Text style={styles.pendingMatchName} selectable>{profile.name}, {profile.age}</Text>
                  <Text style={styles.pendingMatchText} selectable>Oczekuje na wzajemne polubienie</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Usu\u0144 polubienie profilu " + profile.name}
                  onPress={(event) => {
                    event.stopPropagation();
                    Alert.alert("Usu\u0144 polubienie", "Profil wr\u00f3ci do Odkrywaj i nie b\u0119dzie ju\u017c oczekiwa\u0142 na match.", [
                      { text: "Anuluj", style: "cancel" },
                      { text: "Usu\u0144", style: "destructive", onPress: () => void onCancelPendingLike(getProfileKey(profile)) }
                    ]);
                  }}
                  style={styles.pendingCancelButton}
                >
                  <MaterialCommunityIcons name="close" size={19} color={colors.primary} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {pendingRequests.length > 0 && (
        <View style={styles.matchSection}>
          <View style={styles.matchSectionHeader}>
            <Text style={styles.matchSectionTitle} selectable>Prośby o chat</Text>
            <Text style={styles.matchSectionCount}>{pendingRequests.length}</Text>
          </View>
          <View style={styles.pendingMatchList}>
            {pendingRequests.map((profile) => {
              const profileKey = getProfileKey(profile);
              const isIncoming = chatThreads[profileKey]?.requestDirection === "incoming";
              return (
                <Pressable key={profileKey} accessibilityRole="button" accessibilityLabel={"Otw\u00f3rz profil " + profile.name} onPress={() => setPreviewProfile(profile)} style={styles.pendingMatchRow}>
                  <Image source={profile.image} style={styles.pendingMatchAvatar} contentFit="cover" />
                  <View style={styles.fill}>
                    <Text style={styles.pendingMatchName} selectable>{profile.name}, {profile.age}</Text>
                    <Text style={styles.pendingMatchText} selectable>{isIncoming ? "Nowa prośba czeka na Twoją decyzję" : "Prośba wysłana, czeka na akceptację"}</Text>
                  </View>
                  {isIncoming ? (
                    <MaterialCommunityIcons name="email-heart-outline" size={20} color={colors.primary} />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={"Anuluj pro\u015bb\u0119 do " + profile.name}
                      onPress={(event) => {
                        event.stopPropagation();
                        Alert.alert("Anuluj pro\u015bb\u0119", "Czy usun\u0105\u0107 oczekuj\u0105c\u0105 pro\u015bb\u0119 o chat?", [
                          { text: "Nie", style: "cancel" },
                          { text: "Anuluj pro\u015bb\u0119", style: "destructive", onPress: () => void onCancelRequest(profileKey) }
                        ]);
                      }}
                      style={styles.pendingCancelButton}
                    >
                      <MaterialCommunityIcons name="close" size={19} color={colors.primary} />
                    </Pressable>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {previewProfile && (
        <ProfilePreviewSheet
          profile={previewProfile}
          viewerInterests={viewerInterests}
          onClose={() => setPreviewProfile(null)}
          canViewSocials={matchedProfileKeys.includes(getProfileKey(previewProfile))}
          readOnly
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
  messageDraft,
  setMessageDraft,
  onSendMessage,
  onAcceptRequest,
  onRejectRequest,
  onBlockProfile,
  onReportProfile
}: {
  profiles: MatchProfile[];
  matchedProfileKeys: string[];
  chatRequestKeys: string[];
  chatThreads: Record<string, ChatThread>;
  selectedChatKey: string | null;
  setSelectedChatKey: (value: string | null) => void;
  messageDraft: string;
  setMessageDraft: (value: string) => void;
  onSendMessage: (profileKey: string, text: string) => void;
  onAcceptRequest: (profileKey: string) => void;
  onRejectRequest: (profileKey: string) => void;
  onBlockProfile: (profileKey: string) => void;
  onReportProfile: (profileKey: string) => void;
}) {
  const [messageView, setMessageView] = useState<"chats" | "requests">("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const conversations = profiles
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
      const unreadCount = 0;

      return {
        key,
        profile,
        name: profile.surname ? profile.name + " " + profile.surname[0] + "." : profile.name,
        message: isBlocked
          ? "Profil zablokowany."
          : latestMessage?.text ?? (isMatched ? "Match aktywny - możecie pisać." : thread?.introMessage ?? "Prośba o chat czeka na akceptację."),
        time: latestMessage?.time ?? (isMatched ? "aktywny" : "oczekuje"),
        unreadCount,
        status: (isBlocked ? "blocked" : isMatched ? "matched" : "requested") as ChatStatus
      };
    });
  const requestConversations = conversations.filter((conversation) => conversation.status === "requested");
  const chatConversations = conversations.filter((conversation) => conversation.status !== "requested");
  const unreadChatsCount = chatConversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const sourceConversations = messageView === "chats" ? chatConversations : requestConversations;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleConversations = sourceConversations.filter((conversation) =>
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

  return (
    <View style={styles.gapLg}>
      <TopBar eyebrow="Wiadomości" title="Rozmowy" left="message-text-outline" right="account-group-outline" />
      <View style={styles.chatToggleRow}>
        <Pressable accessibilityRole="button" onPress={() => selectMessageView("chats")} style={[styles.chatToggleButton, messageView === "chats" && styles.chatToggleButtonActive]}>
          <MaterialCommunityIcons name="message-text" size={18} color={messageView === "chats" ? colors.ink : colors.muted} />
          <Text style={[styles.chatToggleText, messageView === "chats" && styles.chatToggleTextActive]} selectable>Chaty</Text>
          <Text style={[styles.chatToggleCount, messageView === "chats" && styles.chatToggleCountActive]} selectable>{chatConversations.length}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => selectMessageView("requests")} style={[styles.chatToggleButton, messageView === "requests" && styles.chatToggleButtonActive]}>
          <MaterialCommunityIcons name="email-heart-outline" size={18} color={messageView === "requests" ? colors.ink : colors.muted} />
          <Text style={[styles.chatToggleText, messageView === "requests" && styles.chatToggleTextActive]} selectable>Prośby</Text>
          <Text style={[styles.chatToggleCount, messageView === "requests" && styles.chatToggleCountActive]} selectable>{requestConversations.length}</Text>
        </Pressable>
      </View>
      <View style={styles.chatMiniInfo}>
        <Text style={styles.chatMiniInfoText} selectable>
          {messageView === "chats" ? chatConversations.length + " aktywne" : requestConversations.length + " oczekuj\u0105ce"}
        </Text>
      </View>
      <View style={styles.searchField}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          placeholder={messageView === "chats" ? "Szukaj chatów" : "Szukaj pr\u00f3\u015bb"}
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Wyczy\u015b\u0107 wyszukiwanie" onPress={() => setSearchQuery("")}>
            <MaterialCommunityIcons name="close-circle" size={19} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {visibleConversations.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <View style={styles.emptyStateIcon}><MaterialCommunityIcons name="message-outline" size={27} color={colors.primary} /></View>
          <Text style={styles.emptyStateTitle} selectable>{emptyTitle}</Text>
          <Text style={styles.emptyStateText} selectable>{emptyText}</Text>
        </View>
      ) : (
        <View style={styles.chatList}>
          {visibleConversations.map((conversation) => (
            <Pressable key={conversation.key} onPress={() => setSelectedChatKey(conversation.key)} style={styles.chatItem}>
              <Image source={conversation.profile.image} style={styles.chatAvatar} contentFit="cover" />
              <View style={styles.fill}>
                <Text style={styles.chatName} selectable>{conversation.name}</Text>
                <Text style={styles.chatMessage} numberOfLines={2} selectable>{conversation.message}</Text>
              </View>
              <View style={styles.chatMetaColumn}>
                <Text style={styles.chatTime} selectable>{conversation.time}</Text>
                {conversation.unreadCount > 0 && <Text style={styles.unreadPill} selectable>{conversation.unreadCount}</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <ChatConversationModal
        conversation={selectedConversation}
        thread={selectedConversation ? chatThreads[selectedConversation.key] : undefined}
        draft={messageDraft}
        setDraft={setMessageDraft}
        onClose={() => setSelectedChatKey(null)}
        onSend={onSendMessage}
        onAccept={onAcceptRequest}
        onReject={onRejectRequest}
        onBlock={onBlockProfile}
        onReport={onReportProfile}
      />
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
  onReport
}: {
  conversation: { key: string; profile: MatchProfile; name: string; status: ChatStatus } | null;
  thread?: ChatThread;
  draft: string;
  setDraft: (value: string) => void;
  onClose: () => void;
  onSend: (profileKey: string, text: string) => void;
  onAccept: (profileKey: string) => void;
  onReject: (profileKey: string) => void;
  onBlock: (profileKey: string) => void;
  onReport: (profileKey: string, reason?: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const messages = thread?.messages ?? [];
  const canMessage = conversation?.status === "matched";
  const local = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#050507" },
    header: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
    back: { width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" },
    avatar: { width: 42, height: 42, borderRadius: 14, borderCurve: "continuous" },
    name: { color: colors.ink, fontSize: 15, fontWeight: "900" },
    status: { marginTop: 2, color: colors.green, fontSize: 10, fontWeight: "800" },
    headerActions: { flexDirection: "row", gap: 7 },
    headerAction: { width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
    messages: { flexGrow: 1, justifyContent: messages.length === 0 ? "center" : "flex-end", gap: 9, paddingHorizontal: 14, paddingVertical: 18 },
    empty: { alignItems: "center", gap: 9, padding: 24 },
    emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
    emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", textAlign: "center" },
    emptyText: { maxWidth: 300, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", fontWeight: "700" },
    bubble: { maxWidth: "82%", paddingHorizontal: 13, paddingVertical: 10, borderRadius: 18 },
    bubbleMe: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 6 },
    bubbleThem: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.08)", borderBottomLeftRadius: 6 },
    bubbleText: { color: "#fff", fontSize: 14, lineHeight: 20, fontWeight: "600" },
    bubbleTime: { marginTop: 4, color: "rgba(255,255,255,0.64)", fontSize: 9, fontWeight: "700", textAlign: "right" },
    pending: { margin: 14, gap: 5, padding: 14, borderRadius: 18, backgroundColor: "rgba(255,45,141,0.09)", borderWidth: 1, borderColor: "rgba(255,45,141,0.16)" },
    pendingTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
    pendingText: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "700" },
    pendingActions: { flexDirection: "row", gap: 8, marginTop: 8 },
    acceptButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primary },
    rejectButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)" },
    requestButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
    composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 9, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(5,5,7,0.96)" },
    input: { flex: 1, minHeight: 46, maxHeight: 110, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 20, color: colors.ink, backgroundColor: "rgba(255,255,255,0.07)", fontSize: 14 },
    send: { width: 46, height: 46, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    sendDisabled: { opacity: 0.4 }
  });

  if (!conversation) {
    return null;
  }

  const activeConversation = conversation;

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

  function send() {
    if (!draft.trim() || !canMessage) {
      return;
    }
    onSend(activeConversation.key, draft);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={local.root}>
        <StatusBar style="light" />
        <View style={[local.header, { paddingTop: Math.max(insets.top, 10) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Wroc" onPress={onClose} style={local.back}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.ink} />
          </Pressable>
          <Image source={activeConversation.profile.image} style={local.avatar} contentFit="cover" />
          <View style={styles.fill}>
            <Text style={local.name} selectable>{activeConversation.name}</Text>
            <Text style={local.status} selectable>{canMessage ? "Match aktywny" : activeConversation.status === "blocked" ? "Profil zablokowany" : "Oczekuje na akceptację"}</Text>
          </View>
          <View style={local.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Zgłoś" onPress={confirmReport} style={local.headerAction}>
              <MaterialCommunityIcons name="alert-outline" size={19} color={colors.primaryDeep} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Zablokuj" onPress={confirmBlock} style={local.headerAction}>
              <MaterialCommunityIcons name="block-helper" size={18} color="#ff6b7a" />
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={local.messages} keyboardShouldPersistTaps="handled">
          {messages.length === 0 ? (
            <View style={local.empty}>
              <View style={local.emptyIcon}><MaterialCommunityIcons name="message-outline" size={28} color={colors.primary} /></View>
              <Text style={local.emptyTitle} selectable>{canMessage ? "Zacznij rozmowę" : "Prośba oczekuje"}</Text>
              <Text style={local.emptyText} selectable>{canMessage ? "Napisz pierwszą wiadomość i nawiąż kontakt." : "Wiadomości odblokują się po zaakceptowaniu prośby."}</Text>
            </View>
          ) : messages.map((message) => (
            <View key={message.id} style={[local.bubble, message.from === "me" ? local.bubbleMe : local.bubbleThem]}>
              <Text style={local.bubbleText} selectable>{message.text}</Text>
              <Text style={local.bubbleTime}>{message.time}</Text>
            </View>
          ))}
        </ScrollView>

        {!canMessage ? (
          <View style={[local.pending, { marginBottom: Math.max(insets.bottom, 12) }]}>
            <Text style={local.pendingTitle} selectable>Rozmowa jeszcze zablokowana</Text>
            <Text style={local.pendingText} selectable>{thread?.requestDirection === "incoming" ? "Ta osoba chce rozpocząć rozmowę z Tobą." : "Druga osoba musi zaakceptować prośbę albo odwzajemnić polubienie."}</Text>
            {thread?.requestDirection === "incoming" && (
              <View style={local.pendingActions}>
                <Pressable onPress={() => onReject(activeConversation.key)} style={local.rejectButton}><Text style={local.requestButtonText}>Odrzuć</Text></Pressable>
                <Pressable onPress={() => onAccept(activeConversation.key)} style={local.acceptButton}><Text style={local.requestButtonText}>Akceptuj</Text></Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={[local.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              autoCorrect
              maxLength={2000}
              placeholder="Napisz wiadomość..."
              placeholderTextColor={colors.muted}
              style={local.input}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Wy\u015blij" disabled={!draft.trim()} onPress={send} style={[local.send, !draft.trim() && local.sendDisabled]}>
              <MaterialCommunityIcons name="send" size={20} color="#fff" />
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
  revenueCat
}: {
  premiumPlan: SparkPlanId;
  setPremiumPlan: (value: SparkPlanId) => void;
  revenueCat: RevenueCatState;
}) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const selectedPlan = premiumPlans.find((plan) => plan.id === premiumPlan) ?? premiumPlans[1];
  const hasPackages = revenueCat.packages.length > 0;
  const getPlanPrice = (planId: SparkPlanId, fallback: string) => revenueCat.prices[planId] ?? (revenueCat.configured ? "-" : fallback);
  const selectedPlanPrice = getPlanPrice(premiumPlan, selectedPlan.price);
  const primaryDisabled = busyAction !== null || revenueCat.isLoading || revenueCat.isPro;
  const planCards: Record<SparkPlanId, { label: string; period: string; helper: string; badge?: string }> = {
    weekly: { label: "Tydzień", period: "/ 7 dni", helper: "Dobry start" },
    monthly: { label: "Miesiąc", period: "/ mies.", helper: "Najlepszy wybór" },
    lifetime: { label: "Na zawsze", period: "jednorazowo", helper: "Pełny dostęp", badge: "Best value" }
  };
  const benefitRows = [
    ["advertisements-off", "Zero reklam", "Przeglądanie profili bez przerw i bez bannerów."],
    ["eye-check", "Zobacz, kto Cię polubił", "Odkrywaj osoby, które już dały Ci swipe."],
    ["message-badge", "Prośba o chat", "Napisz do profilu przed matchem i czekaj na akceptację."],
    ["crown", "Korona Pro", "Widoczny status premium przy Twoim profilu."],
    ["image-multiple", "Do 15 zdjęć", "Więcej miejsca na zdjęcia i lepszy podgląd profilu."],
    ["rocket-launch", "Boost widoczności", "Częstsze pojawianie się u innych w odkrywaniu."],
    ["fire", "10 SparkLike miesięcznie", "Więcej wyróżnień dla profili, które naprawdę Cię interesują."]
  ];
  const local = StyleSheet.create({
    screen: { gap: 16 },
    top: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, borderRadius: 24, backgroundColor: "rgba(10,10,14,0.76)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    iconButton: { width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
    topTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
    hero: { alignItems: "center", gap: 8, paddingTop: 8, paddingHorizontal: 8 },
    heroBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: "hidden", color: colors.primary, backgroundColor: "rgba(255,45,141,0.12)", borderWidth: 1, borderColor: "rgba(255,45,141,0.22)", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
    heroTitle: { color: colors.ink, fontSize: 26, lineHeight: 32, textAlign: "center", fontWeight: "900" },
    heroText: { maxWidth: 360, color: "#e4bdc3", fontSize: 13, lineHeight: 20, textAlign: "center", fontWeight: "700" },
    tierGrid: { flexDirection: "row", gap: 8, alignItems: "stretch" },
    tierCard: { flex: 1, minHeight: 136, gap: 6, paddingHorizontal: 8, paddingTop: 14, paddingBottom: 10, alignItems: "center", justifyContent: "center", borderRadius: 22, borderCurve: "continuous", backgroundColor: "rgba(18,18,24,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", overflow: "hidden" },
    tierActive: { borderColor: "rgba(255,45,141,0.9)", backgroundColor: "rgba(33,13,25,0.96)", boxShadow: "0 12px 28px rgba(255,45,141,0.16)" },
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
    benefitsPanel: { gap: 14, padding: 16, borderRadius: 30, borderCurve: "continuous", backgroundColor: "rgba(22,22,29,0.9)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    sectionTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
    benefitRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    benefitIcon: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,45,141,0.14)" },
    benefitTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
    benefitText: { marginTop: 2, color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" },
    primaryCta: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, backgroundColor: colors.primary, boxShadow: "0 18px 38px rgba(255,45,141,0.28)" },
    primaryCtaDisabled: { opacity: 0.48 },
    primaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
    statusBox: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, backgroundColor: "rgba(255,45,141,0.1)", borderWidth: 1, borderColor: "rgba(255,45,141,0.2)" },
    statusText: { flex: 1, color: colors.primaryDeep, fontSize: 12, lineHeight: 18, fontWeight: "800" },
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
        const activated = await revenueCat.presentPaywallIfNeeded();
        if (!activated && revenueCat.error) {
          Alert.alert("Spark Pro", "Nie udało się otworzyć pakietów. Spróbuj ponownie później.");
        }
        return;
      }

      const result = await revenueCat.purchasePlan(selectedPlan.id);
      if (result.ok) {
        Alert.alert("Spark Pro", "Dostęp premium jest aktywny.");
      } else if (!result.cancelled) {
        Alert.alert("Zakup nieudany", result.message);
      }
    } finally {
      setBusyAction(null);
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
        <Text style={local.heroBadge} selectable>{revenueCat.isPro ? "Aktywne" : "Premium"}</Text>
        <Text style={local.heroTitle} selectable>Odblokuj pełen potencjał</Text>
        <Text style={local.heroText} selectable>Zdobądź więcej matchy, lepszą widoczność i funkcje premium z Spark Pro.</Text>
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
          <Text style={local.statusText} selectable>Subskrypcje są chwilowo niedostępne. Spróbuj ponownie później.</Text>
        </View>
      )}
      <Pressable disabled={primaryDisabled} onPress={() => void activateSelectedPlan()} style={[local.primaryCta, primaryDisabled && local.primaryCtaDisabled]}>
        <MaterialCommunityIcons name={(revenueCat.isPro ? "check" : "star-four-points") as any} size={18} color="#fff" />
        <Text style={local.primaryText}>{revenueCat.isPro ? "Spark Pro aktywny" : revenueCat.isLoading ? "Ładowanie pakietów..." : busyAction === "purchase" ? "Łączenie..." : !hasPackages ? "Otwórz paywall Pro" : "Kontynuuj za " + selectedPlanPrice}</Text>
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
function ProfileScreen({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  profileNameMode,
  setProfileNameMode,
  nickname,
  setNickname,
  birthDate,
  intent,
  profileBio,
  setProfileBio,
  onBirthDateChange,
  discoverFilters,
  userCity,
  userCountry,
  locationStatus,
  locationBusy,
  onRequestLocation,
  email,
  selectedInterests,
  setSelectedInterests,
  userAge,
  setUserAge,
  profilePhotos,
  setProfilePhotos,
  privateProfile,
  setPrivateProfile,
  profileName,
  hasPro,
  openPremium,
  openCustomerCenter,
  openSafety,
  onSave
}: {
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  profileNameMode: ProfileNameMode;
  setProfileNameMode: (value: ProfileNameMode) => void;
  nickname: string;
  setNickname: (value: string) => void;
  birthDate: string;
  intent: string;
  profileBio: string;
  setProfileBio: (value: string) => void;
  onBirthDateChange: (value: string) => void;
  discoverFilters: DiscoverFilters;
  userCity: string;
  userCountry: string;
  locationStatus: "idle" | "granted" | "denied";
  locationBusy: boolean;
  onRequestLocation: () => void;
  email: string;
  selectedInterests: string[];
  setSelectedInterests: (value: string[]) => void;
  userAge: number;
  setUserAge: (value: number) => void;
  profilePhotos: ProfilePhoto[];
  setProfilePhotos: (value: ProfilePhoto[]) => void;
  privateProfile: boolean;
  setPrivateProfile: (value: boolean) => void;
  profileName: string;
  premiumPlan: SparkPlanId;
  hasPro: boolean;
  openPremium: () => void;
  openCustomerCenter: () => Promise<{ ok: boolean; message?: string }>;
  openSafety: () => void;
  onSave: () => Promise<boolean>;
}) {
  const [saveBusy, setSaveBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const maxPhotos = hasPro ? 15 : 3;
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
    featuredInterests: selectedInterests.slice(0, 3),
    socials: [],
    premium: hasPro,
    desiredAgeMin: discoverFilters.ageMin,
    desiredAgeMax: discoverFilters.ageMax
  };
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
    setSaveBusy(true);
    const saved = await onSave();
    setSaveBusy(false);
    if (saved) {
      Alert.alert("Profil zapisany", "Zmiany są już widoczne w Twoim profilu.");
    }
  }
  return (
    <View style={styles.profileScreen}>
      <TopBar eyebrow="Profil" title="Twoja karta" left="shield-check" right="account-circle" onLeftPress={openSafety} />

      <View style={styles.profileIdentitySection}>
        <View style={styles.profileIdentityTop}>
          <Pressable accessibilityRole="button" onPress={() => pickProfilePhoto(0)} style={styles.profileAvatarWrap}>
            <Image source={previewSource} style={styles.profileAvatarImage} contentFit="cover" />
            <View style={styles.profileAvatarEdit}>
              <MaterialCommunityIcons name="camera-plus" size={18} color="#fff" />
            </View>
          </Pressable>
          <View style={styles.profileIdentityCopy}>
            <View style={styles.profileNameLine}>
              <Text style={styles.profileDisplayName} numberOfLines={1} selectable>{profileName}</Text>
              {hasPro && <MaterialCommunityIcons name="crown" size={19} color={colors.gold} />}
            </View>
            <Text style={styles.profileDescription} numberOfLines={1} selectable>{email}</Text>
            <View style={styles.profileMetaRow}>
              <View style={styles.profileMetaPill}>
                <MaterialCommunityIcons name="calendar" size={14} color={colors.primary} />
                <Text style={styles.profileMetaText} selectable>{userAge} lat</Text>
              </View>
              <View style={styles.profileMetaPill}>
                <MaterialCommunityIcons name={privateProfile ? "eye-off" : "eye"} size={14} color={colors.primary} />
                <Text style={styles.profileMetaText} selectable>{privateProfile ? "Prywatny" : "Publiczny"}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.profileHeroActions}>
          <Pressable accessibilityRole="button" onPress={() => pickProfilePhoto(0)} style={styles.profileEditCta}>
            <MaterialCommunityIcons name="camera-plus" size={17} color="#fff" />
            <Text style={styles.profileEditCtaText}>Zmień główne zdjęcie</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setPreviewOpen(true)} style={styles.profileSecondaryButton}>
            <MaterialCommunityIcons name="eye" size={17} color={colors.primary} />
            <Text style={styles.profileSecondaryButtonText}>Podgląd</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.profileQuickStats}>
        {profileStatusRows.map(([value, label]) => (
          <View key={label} style={styles.profileQuickStat}>
            <Text style={styles.profileQuickStatValue} selectable>{value}</Text>
            <Text style={styles.profileQuickStatLabel} selectable>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.profilePanel}>
        <View style={styles.profileSectionHeader}>
          <View style={styles.fill}>
            <Text style={styles.eyebrow} selectable>Podstawy</Text>
            <Text style={styles.profileDescription} selectable>Najważniejsze dane widoczne na profilu.</Text>
          </View>
          <Text style={styles.profilePlanBadge} selectable>{hasPro ? "PRO" : "FREE"}</Text>
        </View>
        <View style={styles.segmentedChoice}>
          <Pressable onPress={() => setProfileNameMode("realName")} style={[styles.segmentedChoiceItem, profileNameMode === "realName" && styles.segmentedChoiceItemActive]}><Text style={[styles.segmentedChoiceText, profileNameMode === "realName" && styles.segmentedChoiceTextActive]}>Imię i nazwisko</Text></Pressable>
          <Pressable onPress={() => setProfileNameMode("nickname")} style={[styles.segmentedChoiceItem, profileNameMode === "nickname" && styles.segmentedChoiceItemActive]}><Text style={[styles.segmentedChoiceText, profileNameMode === "nickname" && styles.segmentedChoiceTextActive]}>Nick</Text></Pressable>
        </View>
        {profileNameMode === "realName" ? <View style={styles.nameRow}><TextField label="Imię" value={firstName} onChangeText={setFirstName} /><TextField label="Nazwisko" value={lastName} onChangeText={setLastName} /></View> : <TextField label="Nick" value={nickname} onChangeText={setNickname} />}
        <TextField label="Data urodzenia (RRRR-MM-DD)" value={birthDate} onChangeText={onBirthDateChange} keyboardType="numeric" />
        <Text style={styles.setupHelper}>{calculateAge(birthDate) === null ? "Podaj prawidłową datę." : (calculateAge(birthDate) ?? 0) > 99 ? "Sprawdź rok urodzenia." : String(calculateAge(birthDate)) + " lat"}</Text>
        <ProfileBioInput value={profileBio} onChangeText={setProfileBio} />
        <LocationControl city={userCity} country={userCountry} status={locationStatus} busy={locationBusy} onPress={onRequestLocation} />
      </View>

      <View style={styles.profileGalleryPanel}>
        <View style={styles.profileGalleryHeader}>
          <View style={styles.fill}>
            <Text style={styles.panelTitle} selectable>Zdjęcia</Text>
            <Text style={styles.photoFormatHint} selectable>{visiblePhotoCount}/{maxPhotos} zdjęć - format 4:5</Text>
            <Text style={styles.photoProHint} selectable>{hasPro ? "Spark Pro: limit 15 zdj\u0119\u0107 aktywny" : hiddenPhotoCount > 0 ? `${hiddenPhotoCount} zdj\u0119\u0107 zachowanych - odblokuj Pro, aby je ponownie pokaza\u0107` : "Spark Pro odblokuje do 15 zdj\u0119\u0107"}</Text>
          </View>
          <Pressable onPress={() => (profilePhotos.length >= maxPhotos && !hasPro ? openPremium() : pickProfilePhoto())} style={styles.photoAddButton}>
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
                    accessibilityLabel="Usu\u0144 zdj\u0119cie"
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

      <View style={styles.settingsList}>
        <View style={styles.settingRow}><Text style={styles.settingLabel} selectable>Profil prywatny</Text><Switch value={privateProfile} onValueChange={setPrivateProfile} trackColor={{ true: colors.green }} /></View>
        <SettingRow label="Spark Pro" value={hasPro ? "Aktywne" : "Zobacz"} onPress={openPremium} />
        <SettingRow
          label="Subskrypcja"
          value="Zarządzaj"
          onPress={async () => {
            const result = await openCustomerCenter();
            if (!result.ok && result.message) {
              Alert.alert("Customer Center", result.message);
            }
          }}
        />
        <SettingRow label="Bezpieczeństwo" value="Otwórz" onPress={openSafety} />
      </View>

      <Pressable accessibilityRole="button" disabled={saveBusy} onPress={() => void handleSaveProfile()} style={[styles.primaryButton, saveBusy && styles.primaryButtonDisabled]}>
        <MaterialCommunityIcons name="content-save" size={19} color="#fff" />
        <Text style={styles.primaryButtonText}>{saveBusy ? "Zapisywanie..." : "Zapisz zmiany"}</Text>
      </Pressable>

      {previewOpen && (
        <ProfilePreviewSheet
          profile={ownPreviewProfile}
          viewerInterests={[]}
          onClose={() => setPreviewOpen(false)}
          canViewSocials
          isOwnProfile
          isPrivateProfile={privateProfile}
        />
      )}
    </View>
  );
}

function SimpleInterestPicker({ selected, onToggle, maxSelected = 15 }: { selected: string[]; onToggle: (item: string) => void; maxSelected?: number }) {
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
function SafetyCenter({ onBack, onDeleteAccount }: { onBack: () => void; onDeleteAccount: () => void }) {
  const manageAdPrivacy = async () => {
    try {
      const opened = await openAdsPrivacyOptions();
      if (!opened) {
        Alert.alert("Prywatno\u015b\u0107 reklam", "Dla Twojego regionu nie s\u0105 wymagane dodatkowe ustawienia zg\u00f3d reklamowych.");
      }
    } catch {
      Alert.alert("Prywatno\u015b\u0107 reklam", "Nie uda\u0142o si\u0119 otworzy\u0107 ustawie\u0144. Sprawd\u017a po\u0142\u0105czenie i spr\u00f3buj ponownie.");
    }
  };

  const actions = [
    {
      title: "Zgłoś profil",
      body: "Wy\u015blij zg\u0142oszenie do moderacji z ostatnim kontekstem rozmowy.",
      cta: "W feedzie",
      onPress: () => Alert.alert("Zgłoś profil", "Zgłoszenia wysyłasz z karty profilu lub wątku rozmowy.")
    },
    {
      title: "Zablokuj u\u017cytkownika",
      body: "Ukryj profil, przerwij match i zablokuj wiadomości.",
      cta: "W feedzie",
      onPress: () => Alert.alert("Blokuj", "Blokowanie jest dostępne na karcie profilu i w wiadomościach.")
    },
    {
      title: "Zasady społeczności",
      body: "Szacunek, zgoda, prawdziwa tożsamość i brak nękania.",
      cta: "Czytaj",
      onPress: () => openLegalDocument("Zasady społeczności", legalLinks.community, "EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL")
    },
    {
      title: "Prywatność i dane",
      body: "Polityka prywatności, dane konta, lokalizacja i reklamy.",
      cta: "Otwórz",
      onPress: () => openLegalDocument("Polityka prywatności", legalLinks.privacy, "EXPO_PUBLIC_PRIVACY_POLICY_URL")
    },
    {
      title: "Prywatno\u015b\u0107 reklam",
      body: "Zmie\u0144 wyb\u00f3r dotycz\u0105cy zg\u00f3d i sposobu wy\u015bwietlania reklam.",
      cta: "Ustaw",
      onPress: () => void manageAdPrivacy()
    },
    {
      title: "Regulamin",
      body: "Warunki korzystania, płatności premium i zasady konta.",
      cta: "Otwórz",
      onPress: () => openLegalDocument("Regulamin", legalLinks.terms, "EXPO_PUBLIC_TERMS_URL")
    }
  ];

  return (
    <View style={styles.gapLg}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.ink} />
        </Pressable>
        <View style={styles.fill}>
          <Text style={styles.eyebrow} selectable>Bezpieczeństwo</Text>
          <Text style={styles.screenTitle} selectable>Centrum bezpieczeństwa</Text>
        </View>
        <IconButton label="?" onPress={() => openSupportEmail("Spark - pomoc i bezpiecze\u0144stwo")} />
      </View>

      <View style={styles.safetyHero}>
        <View style={styles.safetyHeroIcon}><MaterialCommunityIcons name={"shield-heart" as any} size={28} color={colors.primaryDeep} /></View>
        <Text style={styles.safetyHeroTitle} selectable>Bezpieczne poznawanie ludzi</Text>
        <Text style={styles.safetyHeroText} selectable>
          Ka\u017cdy profil mo\u017ce zosta\u0107 zg\u0142oszony lub zablokowany. Zg\u0142oszenia trafiaj\u0105 do moderacji, a blokada natychmiast ukrywa profil i przerywa kontakt.
        </Text>
      </View>

      <View style={styles.safetyList}>
        {actions.map((action) => (
          <Pressable key={action.title} onPress={action.onPress} style={styles.safetyAction}>
            <View style={styles.fill}>
              <Text style={styles.safetyActionTitle} selectable>{action.title}</Text>
              <Text style={styles.safetyActionText} selectable>{action.body}</Text>
            </View>
            <Text style={styles.safetyActionCta}>{action.cta}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.deleteCard}>
        <Text style={styles.deleteTitle} selectable>Usunięcie konta w aplikacji</Text>
        <Text style={styles.deleteText} selectable>
          Usunie konto, zdj\u0119cia, profil, polubienia, matche i wiadomo\u015bci. Minimalne dane bezpiecze\u0144stwa i rozlicze\u0144 mog\u0105 zosta\u0107 zachowane zgodnie z polityk\u0105 prywatno\u015bci.
        </Text>
        <Pressable accessibilityRole="button" onPress={onDeleteAccount} style={styles.deleteAccountButton}>
          <Text style={styles.deleteAccountButtonText}>Usuń konto</Text>
        </Pressable>
      </View>
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
    color: "#d8b5c7",
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
  authSubtitle: { maxWidth: 340, color: "#d8b5c7", fontSize: 14, lineHeight: 20, textAlign: "center", fontWeight: "600" },
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
    backgroundColor: "rgba(26,26,34,0.88)",
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
    backgroundColor: "rgba(255,255,255,0.04)"
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
    backgroundColor: "rgba(255,255,255,0.04)"
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
    backgroundColor: "rgba(22,22,29,0.92)",
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
    color: "#d8b5c7",
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
    backgroundColor: "rgba(18,18,25,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.22)",
    boxShadow: "0 20px 48px rgba(0,0,0,0.34)"
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
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  ageRangeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  ageRangeValue: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  setupSection: {
    gap: 13,
    padding: 16,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(18,18,24,0.92)",
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
    backgroundColor: "rgba(255,255,255,0.05)"
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
  setupHelper: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  locationControl: { gap: 8, marginTop: 4 },
  locationStatus: { flexDirection: "row", alignItems: "center", gap: 7 },
  locationStatusText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  locationAction: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
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
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)"
  },
  settingHint: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 15 },
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
    borderColor: "rgba(255,45,141,0.16)",
    backgroundColor: "rgba(18,18,25,0.82)",
    boxShadow: "0 14px 34px rgba(99,51,61,0.07)"
  },
  intentCardActive: {
    borderColor: "rgba(255,45,141,0.32)",
    backgroundColor: "rgba(34,20,31,0.96)"
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
    backgroundColor: "rgba(22,22,29,0.86)",
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
    color: "#d8b5c7",
    fontSize: 13,
    lineHeight: 19
  },
  agePanel: {
    gap: 12,
    padding: 16,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: "rgba(22,22,29,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.22)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.32)"
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
    backgroundColor: "rgba(22,22,29,0.86)"
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
    backgroundColor: "rgba(30,30,38,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
  },
  secondaryButtonWide: {
    minHeight: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30,30,38,0.9)",
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
    backgroundColor: "rgba(24,24,31,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  purchaseActionsRow: {
    flexDirection: "row",
    gap: 10
  },
  purchaseHint: {
    color: "#d8b5c7",
    fontSize: 12,
    lineHeight: 18
  },
  revenueCatError: {
    color: colors.primaryDeep,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800"
  },
  discoverScreen: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    gap: 8,
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    overflow: "hidden"
  },
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
    color: "#f0d3dd",
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
    borderColor: "rgba(255,255,255,0.18)",
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
    backgroundColor: "rgba(26,26,26,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
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
    backgroundColor: "rgba(18,17,22,0.9)",
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
    borderLeftColor: "rgba(255,255,255,0.08)"
  },
  discoverSummaryText: {
    minWidth: 0,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900"
  },
  stitchPlanButtonActive: {
    backgroundColor: colors.primary,
    boxShadow: "0 0 28px rgba(255,76,131,0.28)"
  },
  stitchPlanText: {
    color: "#e4bdc3",
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
    backgroundColor: "rgba(5,5,7,0.72)",
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
    backgroundColor: "rgba(8,32,20,0.78)"
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
    backgroundColor: "rgba(26,26,26,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  stitchProHintText: {
    flex: 1,
    color: "#e4bdc3",
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
    backgroundColor: "rgba(26,26,26,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
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
    backgroundColor: "rgba(26,26,26,0.64)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.34)"
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
    backgroundColor: "rgba(2,2,5,0.7)"
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
    boxShadow: "18px 0 54px rgba(0,0,0,0.52)"
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
    width: 30,
    height: 30
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
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
  discoveryMenuActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  discoveryDrawerDivider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: "rgba(255,255,255,0.08)"
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
    boxShadow: "0 -20px 54px rgba(0,0,0,0.48)"
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
    borderColor: "rgba(255,255,255,0.08)"
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
    borderTopColor: "rgba(255,255,255,0.08)"
  },
  discoveryResetButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 15,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.07)",
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
    backgroundColor: "rgba(0,0,0,0.58)"
  },
  reportSheet: {
    gap: 14,
    padding: 18,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "rgba(18,18,25,0.98)",
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
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  reportInput: {
    minHeight: 126,
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    color: colors.ink,
    backgroundColor: "rgba(5,5,7,0.84)",
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
    backgroundColor: "rgba(22,22,29,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.12)"
  },
  monetizationStatusText: {
    color: "#d8b5c7",
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
    width: 18,
    height: 18
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,18,24,0.78)",
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
    backgroundColor: "rgba(18,18,25,0.78)",
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
    boxShadow: "0 12px 30px rgba(0,0,0,0.34)"
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
    borderColor: "rgba(255,255,255,0.06)",
    boxShadow: "0 24px 64px rgba(0,0,0,0.54)"
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
    backgroundColor: "rgba(18,18,22,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    fontSize: 11,
    fontWeight: "900"
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
    color: "#f0d3dd",
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
    backgroundColor: "rgba(26,26,26,0.62)",
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    color: colors.primary,
    backgroundColor: "rgba(255,45,141,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.22)",
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
    backgroundColor: "rgba(26,26,26,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  matchScoreText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  matchReasonText: {
    color: "#e4bdc3",
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
    backgroundColor: "rgba(22,22,29,0.86)",
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
    backgroundColor: "rgba(30,30,38,0.9)",
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
    backgroundColor: "rgba(26,26,34,0.88)",
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
    color: "#d8b5c7",
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
    backgroundColor: "rgba(22,22,29,0.86)",
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
    backgroundColor: "rgba(14,14,20,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.36)"
  },
  planCardActive: {
    borderColor: "rgba(255,45,141,0.58)",
    backgroundColor: "rgba(37,10,27,0.96)",
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
    borderColor: "rgba(255,255,255,0.18)"
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
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
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
  matchCard: {
    position: "relative",
    width: "48%",
    overflow: "hidden",
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    boxShadow: "0 16px 34px rgba(0,0,0,0.26)"
  },
  matchImage: {
    width: "100%",
    aspectRatio: 4 / 5
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
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  pendingMatchAvatar: {
    width: 52,
    height: 52,
    borderRadius: 17,
    borderCurve: "continuous"
  },
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
    backgroundColor: "rgba(10,10,14,0.72)"
  },
  chatToggleButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.04)"
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
    backgroundColor: "rgba(255,255,255,0.08)",
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
  chatMessage: {
    maxWidth: 210,
    marginTop: 3,
    color: colors.muted,
    fontSize: 13
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
    backgroundColor: "rgba(32,20,30,0.94)"
  },
  threadPanel: {
    gap: 14,
    padding: 16,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: "rgba(24,24,31,0.88)",
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
    color: "#d8b5c7",
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
    backgroundColor: "rgba(30,30,38,0.9)"
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
    backgroundColor: "rgba(30,30,38,0.9)",
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
    backgroundColor: "rgba(24,24,31,0.88)",
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
    backgroundColor: "rgba(10,10,14,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  profileRoundIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
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
    backgroundColor: "rgba(18,18,25,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.42)"
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
    backgroundColor: "rgba(255,255,255,0.06)",
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
    backgroundColor: "rgba(255,255,255,0.06)",
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
    backgroundColor: "#15151c",
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
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
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
    backgroundColor: "rgba(18,18,25,0.88)",
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
  profileGalleryPanel: {
    gap: 14,
    padding: 14,
    borderRadius: 28,
    backgroundColor: "rgba(18,18,25,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
  },
  profilePreviewPanel: {
    gap: 14,
    padding: 14,
    borderRadius: 28,
    backgroundColor: "rgba(18,18,25,0.88)",
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
    backgroundColor: "rgba(255,255,255,0.04)"
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
    backgroundColor: "#15151c",
    boxShadow: "0 26px 66px rgba(0,0,0,0.44)"
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
    backgroundColor: "rgba(30,30,38,0.9)",
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
    backgroundColor: "rgba(22,22,29,0.86)",
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
    backgroundColor: "rgba(12,10,14,0.86)",
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
    backgroundColor: "rgba(26,26,34,0.88)",
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
    backgroundColor: "rgba(14,14,19,0.76)",
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
    color: "#d8b5c7",
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
    color: "#f0d3dd",
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
    backgroundColor: "rgba(34,12,25,0.9)",
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
    backgroundColor: "rgba(30,30,38,0.9)",
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
    backgroundColor: "rgba(24,24,31,0.88)",
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
    backgroundColor: "rgba(22,22,29,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)"
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
    backgroundColor: "rgba(22,22,29,0.86)",
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
    backgroundColor: "rgba(255,255,255,0.08)"
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
    backgroundColor: "rgba(22,22,29,0.86)",
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
    backgroundColor: "rgba(22,22,29,0.9)",
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
    backgroundColor: "rgba(22,22,29,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)"
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
    backgroundColor: "rgba(26,26,34,0.88)",
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
    color: "#d8b5c7",
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
    color: "#d8b5c7",
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
    backgroundColor: "rgba(0,0,0,0.78)"
  },
  matchCelebrationCard: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
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
    width: 126,
    height: 158,
    marginVertical: 4,
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 3,
    borderColor: colors.primary
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
  bottomNav: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 6,
    minHeight: 68,
    flexDirection: "row",
    gap: 4,
    padding: 7,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)"
  },
  navButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  navButtonActive: {
    backgroundColor: "rgba(255,45,141,0.22)"
  },
  navIcon: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "900"
  },
  navText: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900"
  },
  navTextActive: {
    color: colors.primary
  }
});
