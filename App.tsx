import { FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Google from "expo-auth-session/providers/google";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Linking,
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
import { deleteCurrentUserAccount, signInWithEmail, signInWithGoogleIdToken, signUpWithEmail, type AppAuthUser } from "./src/auth";
import { firebaseConfigStatus, isFirebaseConfigured } from "./src/firebase";
import {
  blockUser,
  createChatRequest,
  createMatchThread,
  createReport,
  recordUserLogin,
  requestAccountDeletionAndDeleteProfile,
  sendChatMessage,
  upsertUserProfile
} from "./src/firestore";
import { googleClientIds, isGoogleSignInConfigured } from "./src/google-sign-in";
import { SparkAdBanner, useGoogleMobileAds, useSwipeInterstitialAds } from "./src/ads";
import { revenueCatEntitlementId, useRevenueCat, type RevenueCatState, type SparkPlanId } from "./src/revenuecat";

WebBrowser.maybeCompleteAuthSession();

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
  privacy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || "https://raw.githubusercontent.com/wychorak/spark-new/main/docs/legal/privacy-policy.md",
  terms: process.env.EXPO_PUBLIC_TERMS_URL || "https://raw.githubusercontent.com/wychorak/spark-new/main/docs/legal/terms.md",
  community: process.env.EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL || "https://raw.githubusercontent.com/wychorak/spark-new/main/docs/legal/community-guidelines.md"
};

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
const loginLogoImage = require("./assets/ChatGPT_Image_1_lip_2026__15_32_40-removebg-preview_waifu2x_3x_png.png");

const profileImages = [
  require("./assets/profiles/profile-1.jpg"),
  require("./assets/profiles/profile-2.jpg"),
  require("./assets/profiles/profile-3.jpg"),
  require("./assets/profiles/profile-4.jpg"),
  require("./assets/profiles/profile-5.jpg"),
  require("./assets/profiles/profile-6.jpg")
];

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

  if (normalized.includes("linkedin")) {
    return { family: "fontAwesome", name: "linkedin", color: "#70b7ff", backgroundColor: "rgba(112,183,255,0.15)" };
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
type Mode = "classic" | "premium";
type DiscoverFilters = { nearbyOnly: boolean; proOnly: boolean; ageMin: number; ageMax: number; minHeight: number; maxHeight: number; minWeight: number; maxWeight: number };
type AuthMode = "login" | "register";
type SwipeAction = "pass" | "like" | "superlike";
type AgeBand = "18+" | "under18" | null;
type ProfilePhoto = number | string;
type ChatStatus = "matched" | "requested" | "blocked";
type SocialIconFamily = "fontAwesome" | "fontAwesome5" | "material";

type ChatThread = {
  profileKey: string;
  status: ChatStatus;
  introMessage?: string;
  messages: Array<{ id: string; from: "me" | "them"; text: string; time: string }>;
};

type MatchProfile = {
  name: string;
  surname: string;
  age: number;
  city: string;
  bio: string;
  distance: string;
  latitude: number;
  longitude: number;
  image: any;
  photos?: any[];
  interests: string[];
  featuredInterests?: string[];
  socials: { label: string; value: string }[];
  premium?: boolean;
  desiredAgeMin?: number;
  desiredAgeMax?: number;
  heightCm?: number;
  weightKg?: number;
  matchScore?: number;
  matchReasons?: string[];
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

const interestCategories = [
  { title: "Popularne", icon: "heart", items: ["Filmy", "Natura", "Muzyka", "Kawa", "Sport", "Sztuka", "Podróże", "Gaming", "Książki", "Kuchnia", "Fotografia", "Tech", "Joga", "Koncerty", "Planszówki", "LGBT+"] },
  { title: "Lifestyle", icon: "sparkles", items: ["Moda", "Streetwear", "Siłownia", "Bieganie", "Zdrowe jedzenie", "Gotowanie", "Kawiarnie", "Nocne spacery", "Tatuaże", "Samorozwój", "Minimalizm", "Anime"] },
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
    premium: true
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
      { label: "Spotify", value: "Kuba live set" },
      { label: "LinkedIn", value: "kuba-zielinski" }
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
  if (process.env.EXPO_OS === "ios") {
    Haptics.selectionAsync();
  }
}

function toggleListItem(items: string[], item: string) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
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

function getProfileKey(profile: MatchProfile) {
  return `${profile.name}-${profile.surname}`;
}

function getProfileGallery(profile: MatchProfile) {
  const fallbackPhotos = [profile.image, ...profileImages.filter((image) => image !== profile.image)];
  return (profile.photos && profile.photos.length > 0 ? profile.photos : fallbackPhotos).slice(0, 3);
}

function getFeaturedInterests(profile: MatchProfile) {
  return (profile.featuredInterests && profile.featuredInterests.length > 0 ? profile.featuredInterests : profile.interests).slice(0, 3);
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getApproxDistanceLabel(userLocation: UserLocation | null, profile: MatchProfile) {
  if (!userLocation) {
    return profile.distance;
  }

  const earthRadiusKm = 6371;
  const latitudeDelta = degreesToRadians(profile.latitude - userLocation.latitude);
  const longitudeDelta = degreesToRadians(profile.longitude - userLocation.longitude);
  const startLatitude = degreesToRadians(userLocation.latitude);
  const endLatitude = degreesToRadians(profile.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const distanceKm = 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return `${Math.max(1, Math.round(distanceKm))} km`;
}

function getDistanceKm(userLocation: UserLocation | null, profile: MatchProfile) {
  if (!userLocation) {
    return Number(profile.distance.replace(/[^0-9]/g, "")) || 25;
  }

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
}) {
  const distanceKm = getDistanceKm(params.userLocation, params.profile);
  const sharedInterests = params.profile.interests.filter((interest) => params.selectedInterests.includes(interest));
  const interestBase = Math.max(3, Math.min(15, params.selectedInterests.length || params.profile.interests.length || 3));
  const interestPercent = Math.round((sharedInterests.length / interestBase) * 100);
  const visibilityBoost = params.profile.premium ? 4 : 0;
  const score = Math.max(12, Math.min(99, interestPercent + visibilityBoost));
  const reasons = [
    `${Math.max(1, Math.round(distanceKm))} km`,
    `${params.profile.age} lat`,
    sharedInterests.length > 0 ? sharedInterests.slice(0, 3).join(" + ") : "odkryj nowe zainteresowania",
    ...(visibilityBoost > 0 ? ["boost Pro"] : [])
  ];

  return { score, reasons, sharedInterests };
}

function getThreadId(uid: string | null | undefined, profileKey: string) {
  return `${uid || "local"}_${profileKey}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [authDone, setAuthDone] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [firstName, setFirstName] = useState("Alex");
  const [lastName, setLastName] = useState("Mercer");
  const [email, setEmail] = useState("alex@spark.app");
  const [password, setPassword] = useState("sparkdemo");
  const [confirmPassword, setConfirmPassword] = useState("sparkdemo");
  const [onboarded, setOnboarded] = useState(false);
  const [intent, setIntent] = useState("Randki");
  const [ageBand, setAgeBand] = useState<AgeBand>(null);
  const [selectedInterests, setSelectedInterests] = useState(["Filmy", "Natura", "Kawa", "Sztuka"]);
  const [tab, setTab] = useState<Tab>("discover");
  const [mode, setMode] = useState<Mode>("classic");
  const [discoverFilters, setDiscoverFilters] = useState<DiscoverFilters>({ nearbyOnly: false, proOnly: false, ageMin: 18, ageMax: 35, minHeight: 140, maxHeight: 210, minWeight: 40, maxWeight: 130 });
  const [pushEnabled, setPushEnabled] = useState(true);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [premiumPlan, setPremiumPlan] = useState<SparkPlanId>("monthly");
  const [appUser, setAppUser] = useState<AppAuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const revenueCat = useRevenueCat(appUser?.uid ?? null);
  const adsReady = useGoogleMobileAds(!revenueCat.isPro);
  const trackSwipeAd = useSwipeInterstitialAds(!revenueCat.isPro && adsReady);
  const [profileIndex, setProfileIndex] = useState(0);
  const [matchedProfileKeys, setMatchedProfileKeys] = useState<string[]>([]);
  const [chatRequestKeys, setChatRequestKeys] = useState<string[]>([]);
  const [blockedProfileKeys, setBlockedProfileKeys] = useState<string[]>([]);
  const [chatThreads, setChatThreads] = useState<Record<string, ChatThread>>({});
  const [selectedChatKey, setSelectedChatKey] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [superlikesRemaining, setSuperlikesRemaining] = useState(10);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [userAge, setUserAge] = useState(24);
  const [profilePhotos, setProfilePhotos] = useState<ProfilePhoto[]>([profileImages[4]]);

  const [, googleResponse, promptGoogleSignIn] = Google.useAuthRequest({
    clientId: googleClientIds.webClientId ?? "firebase-not-configured.apps.googleusercontent.com",
    iosClientId: googleClientIds.iosClientId,
    androidClientId: googleClientIds.androidClientId,
    webClientId: googleClientIds.webClientId,
    responseType: "id_token"
  });

  const isCompact = width < 380;
  const profileName = `${firstName.trim() || "Alex"} ${lastName.trim() || "Mercer"}`;
  const sortedProfiles = useMemo(
    () =>
      matchProfiles
        .filter((profile) => !blockedProfileKeys.includes(getProfileKey(profile)))
        .filter((profile) => selectedInterests.length === 0 || profile.interests.some((interest) => selectedInterests.includes(interest)))
        .filter((profile) => !discoverFilters.nearbyOnly || getDistanceKm(userLocation, profile) <= 25)
        .filter((profile) => !discoverFilters.proOnly || Boolean(profile.premium))
        .map((profile) => {
          const result = scoreProfileMatch({ profile, selectedInterests, userLocation, userAge });

          return {
            ...profile,
            distance: getApproxDistanceLabel(userLocation, profile),
            matchScore: result.score,
            matchReasons: result.reasons
          };
        })
        .sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0)),
    [blockedProfileKeys, discoverFilters, selectedInterests, userAge, userLocation]
  );
  const visibleProfiles = sortedProfiles.length > 0 ? sortedProfiles : matchProfiles;
  const activeProfile = visibleProfiles[profileIndex % visibleProfiles.length];
  const activeProfileWithDistance = useMemo(
    () => ({
      ...activeProfile,
      distance: getApproxDistanceLabel(userLocation, activeProfile)
    }),
    [activeProfile, userLocation]
  );
  const activeProfileKey = getProfileKey(activeProfile);
  const hasMatchedActiveProfile = matchedProfileKeys.includes(activeProfileKey);
  const hasRequestedActiveProfile = chatRequestKeys.includes(activeProfileKey);
  const canContinue = selectedInterests.length >= 3 && (intent === "Randki" ? ageBand === "18+" : ageBand !== null);

  const contentPadding = useMemo(
    () => ({
      paddingTop: authDone && onboarded ? Math.max(insets.top + 16, 28) : Math.max(insets.top + 34, 54),
      paddingBottom: authDone && onboarded ? insets.bottom + 108 : insets.bottom + 28,
      paddingHorizontal: isCompact ? 16 : 20
    }),
    [authDone, insets.bottom, insets.top, isCompact, onboarded]
  );
  const discoverMinHeight = Math.max(620, height - contentPadding.paddingTop - contentPadding.paddingBottom);

  useEffect(() => {
    const idToken = googleResponse?.type === "success" ? googleResponse.params.id_token : undefined;

    if (!idToken) {
      return;
    }

    setAuthBusy(true);
    setAuthError(null);
    signInWithGoogleIdToken(idToken)
      .then(async (user) => {
        await recordUserLogin({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          authProvider: "google",
          fallbackFirstName: firstName,
          fallbackLastName: lastName
        });
        setAppUser(user);
        setEmail(user.email ?? email);
        setAuthDone(true);
      })
      .catch((error: Error) => setAuthError(error.message))
      .finally(() => setAuthBusy(false));
  }, [email, firstName, googleResponse, lastName]);

  useEffect(() => {
    if (!authDone || !onboarded || userLocation || locationStatus === "denied") {
      return;
    }

    let mounted = true;

    async function loadLocation() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!mounted) {
          return;
        }

        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setLocationStatus("denied");
          return;
        }

        setLocationStatus("granted");
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });

        if (mounted) {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        }
      } catch {
        if (mounted) {
          setLocationStatus("denied");
        }
      }
    }

    loadLocation();

    return () => {
      mounted = false;
    };
  }, [authDone, locationStatus, onboarded, userLocation]);

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
        introMessage: "Hej, widze wspolne klimaty. Masz ochote pogadac?",
        messages: []
      }
    }));
    setSelectedInterests(["Filmy", "Natura", "Kawa", "Sztuka"]);
    setAgeBand("18+");
    setOnboarded(true);
    setTab("messages");
  }

  async function handleEmailAuth() {
    setAuthBusy(true);
    setAuthError(null);

    try {
      if (authMode === "register" && password !== confirmPassword) {
        setAuthError("Hasła nie są takie same.");
        return;
      }

      const user =
        authMode === "register"
          ? await signUpWithEmail({ email, password, firstName, lastName })
          : await signInWithEmail(email, password);

      await recordUserLogin({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        authProvider: "email",
        fallbackFirstName: firstName,
        fallbackLastName: lastName
      });
      setAppUser(user);
      setAuthDone(true);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Firebase authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function saveProfileToFirestore() {
    if (!appUser) {
      return;
    }

    try {
      await upsertUserProfile({
        uid: appUser.uid,
        firstName,
        lastName,
        email: appUser.email ?? email,
        intent,
        ageBand,
        age: userAge,
        interests: selectedInterests,
        photoUrls: profilePhotos.filter((photo): photo is string => typeof photo === "string"),
        mainPhotoUrl: typeof profilePhotos[0] === "string" ? profilePhotos[0] : null,
        location: userLocation,
        premiumPlan: revenueCat.isPro ? premiumPlan : "free",
        isPro: revenueCat.isPro,
        profilePhotoLimit: revenueCat.isPro ? 15 : 3,
        proVisibilityBoost: revenueCat.isPro ? "priority" : "standard",
        canSeeIncomingLikes: revenueCat.isPro,
        canSendChatRequests: revenueCat.isPro,
        privateProfile,
        socials: {
          instagram: "@alex.spark",
          tiktok: "@alexconnects",
          spotify: "Pink night walks",
          linkedin: "alex-mercer"
        }
      });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not save Firestore profile.");
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

  async function handleSwipe(action: SwipeAction) {
    tap();

    if (action === "superlike") {
      if (!revenueCat.isPro) {
        await revenueCat.presentPaywallIfNeeded();
        return;
      }

      if (superlikesRemaining <= 0) {
        Alert.alert("Superlike", "Limit 10 zjawiskowych Superlike w tym miesiącu jest już wykorzystany.");
        return;
      }

      setSuperlikesRemaining((value) => Math.max(0, value - 1));
    }

    if (action === "like" || action === "superlike") {
      setMatchedProfileKeys((keys) => (keys.includes(activeProfileKey) ? keys : [...keys, activeProfileKey]));
      setSelectedChatKey(activeProfileKey);
      setChatThreads((threads) => ({
        ...threads,
        [activeProfileKey]: threads[activeProfileKey] ?? {
          profileKey: activeProfileKey,
          status: "matched",
          messages: [
            { id: `${Date.now()}-match`, from: "them", text: "Match! Mozecie juz pisac.", time: "teraz" }
          ]
        }
      }));
      if (appUser) {
        createMatchThread({
          matchId: getThreadId(appUser.uid, activeProfileKey),
          memberUids: [appUser.uid, activeProfileKey],
          createdByUid: appUser.uid,
          source: "mutual-like"
        }).catch(() => undefined);
      }
      Alert.alert("Match", `Ty i ${activeProfile.name} polubiliście się. Możecie teraz pisać.`);
    }

    trackSwipeAd();
    setProfileIndex((value) => value + 1);
  }

  async function sendPremiumChatRequest() {
    tap();

    if (!revenueCat.isPro) {
      await revenueCat.presentPaywallIfNeeded();
      return;
    }

    if (hasMatchedActiveProfile) {
      Alert.alert("Chat", `Masz już match z ${activeProfile.name}. Rozmowa jest odblokowana.`);
      setTab("messages");
      return;
    }

    if (hasRequestedActiveProfile) {
      Alert.alert("Prośba wysłana", `Jedna prośba o chat do ${activeProfile.name} już czeka na akceptację.`);
      return;
    }

    setChatRequestKeys((keys) => [...keys, activeProfileKey]);
    setSelectedChatKey(activeProfileKey);
    setChatThreads((threads) => ({
      ...threads,
      [activeProfileKey]: {
        profileKey: activeProfileKey,
        status: "requested",
        introMessage: "Hej, mamy wspolne zainteresowania. Chcesz pogadac?",
        messages: []
      }
    }));
    if (appUser) {
      createChatRequest({
        requestId: getThreadId(appUser.uid, activeProfileKey),
        fromUid: appUser.uid,
        toProfileKey: activeProfileKey,
        introMessage: "Hej, mamy wspolne zainteresowania. Chcesz pogadac?"
      }).catch(() => undefined);
      createMatchThread({
        matchId: getThreadId(appUser.uid, activeProfileKey),
        memberUids: [appUser.uid, activeProfileKey],
        createdByUid: appUser.uid,
        source: "premium-request"
      }).catch(() => undefined);
    }
    Alert.alert("Prośba o chat", `Wysłano jedną premium prośbę do ${activeProfile.name}.`);
  }

  async function sendMessageToProfile(profileKey: string, text: string) {
    const message = text.trim();

    if (!message) {
      return;
    }

    const thread = chatThreads[profileKey];
    if (!thread || thread.status !== "matched") {
      Alert.alert("Chat", "Wiadomości są dostępne po matchu albo po zaakceptowaniu prośby.");
      return;
    }

    setChatThreads((threads) => ({
      ...threads,
      [profileKey]: {
        ...thread,
        messages: [...thread.messages, { id: `${Date.now()}-me`, from: "me", text: message, time: "teraz" }]
      }
    }));
    setMessageDraft("");

    if (appUser) {
      sendChatMessage({
        threadId: getThreadId(appUser.uid, profileKey),
        senderUid: appUser.uid,
        text: message
      }).catch(() => undefined);
    }
  }

  function blockProfile(profileKey: string) {
    setBlockedProfileKeys((keys) => (keys.includes(profileKey) ? keys : [...keys, profileKey]));
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
    if (appUser) {
      blockUser({ blockerUid: appUser.uid, blockedUid: profileKey }).catch(() => undefined);
    }
  }

  function reportProfile(profileKey: string, reason = "Nieodpowiedni profil lub wiadomość") {
    if (appUser) {
      createReport({
        reporterUid: appUser.uid,
        targetUid: profileKey,
        reason,
        context: "Spark app report"
      }).catch(() => undefined);
    }
  }


  async function performDeleteAccount() {
    if (!appUser) {
      Alert.alert("Usuń konto", "Musisz być zalogowany, aby usunąć konto.");
      return;
    }

    try {
      await requestAccountDeletionAndDeleteProfile({
        uid: appUser.uid,
        email: appUser.email ?? email
      });
      await deleteCurrentUserAccount();

      setAppUser(null);
      setAuthDone(false);
      setOnboarded(false);
      setMatchedProfileKeys([]);
      setChatRequestKeys([]);
      setBlockedProfileKeys([]);
      setChatThreads({});
      setSelectedChatKey(null);
      setTab("discover");
      setMode("classic");
      Alert.alert("Konto usunięte", "Konto i główny profil zostały usunięte.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się usunąć konta.";
      setAuthError(message);
      Alert.alert("Usuń konto", message);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert("Usuń konto", "To usunie konto logowania i główny profil. Tej akcji nie można cofnąć.", [
      { text: "Anuluj", style: "cancel" },
      { text: "Usuń", style: "destructive", onPress: () => void performDeleteAccount() }
    ]);
  }
  if (!authDone) {
    return (
      <ScreenFrame contentPadding={contentPadding}>
        <AuthScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
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
          onContinue={() => {
            tap();
            handleEmailAuth();
          }}
          onGoogle={() => {
            tap();
            setAuthError(null);
            promptGoogleSignIn();
          }}
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
          ageBand={ageBand}
          setAgeBand={setAgeBand}
          selectedInterests={selectedInterests}
          setSelectedInterests={setSelectedInterests}
          canContinue={canContinue}
          onContinue={async () => {
            if (!canContinue) {
              return;
            }
            tap();
            await saveProfileToFirestore();
            setOnboarded(true);
          }}
        />
      </ScreenFrame>
    );
  }

  return (
    <LinearGradient colors={["#050507", "#150711", "#050507"]} style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.scroll, tab === "discover" && styles.discoverScroll, contentPadding]}>
        {tab === "discover" && (
          <DiscoverScreen
            mode={mode}
            setMode={setMode}
            profile={activeProfileWithDistance}
            hasPro={revenueCat.isPro}
            requestProAccess={revenueCat.presentPaywallIfNeeded}
            onSwipe={handleSwipe}
            onPremiumChatRequest={sendPremiumChatRequest}
            onOpenMessages={() => setTab("messages")}
            reporterName={profileName}
            hasMatchedProfile={hasMatchedActiveProfile}
            hasRequestedProfile={hasRequestedActiveProfile}
            superlikesRemaining={superlikesRemaining}
            selectedInterests={selectedInterests}
            setSelectedInterests={setSelectedInterests}
            userAge={userAge}
            setUserAge={setUserAge}
            discoverFilters={discoverFilters}
            setDiscoverFilters={setDiscoverFilters}
            screenMinHeight={discoverMinHeight}
            onReportProfile={(reason) => reportProfile(activeProfileKey, reason)}
          />
        )}
        {tab === "matches" && <MatchesScreen matchedProfileKeys={matchedProfileKeys} chatRequestKeys={chatRequestKeys} />}
        {tab === "messages" && (
          <MessagesScreen
            matchedProfileKeys={matchedProfileKeys}
            chatRequestKeys={chatRequestKeys}
            chatThreads={chatThreads}
            selectedChatKey={selectedChatKey}
            setSelectedChatKey={setSelectedChatKey}
            messageDraft={messageDraft}
            setMessageDraft={setMessageDraft}
            onSendMessage={sendMessageToProfile}
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
            email={email}
            selectedInterests={selectedInterests}
            setSelectedInterests={setSelectedInterests}
            userAge={userAge}
            setUserAge={setUserAge}
            profilePhotos={profilePhotos}
            setProfilePhotos={setProfilePhotos}
            pushEnabled={pushEnabled}
            setPushEnabled={setPushEnabled}
            privateProfile={privateProfile}
            setPrivateProfile={setPrivateProfile}
            profileName={profileName}
            premiumPlan={premiumPlan}
            hasPro={revenueCat.isPro}
            openPremium={() => setTab("premium")}
            openCustomerCenter={revenueCat.openCustomerCenter}
            openSafety={() => setTab("safety")}
          />
        )}
        <SparkAdBanner enabled={!revenueCat.isPro && adsReady && tab !== "premium"} placement={tab} />
      </ScrollView>

            <BlurView intensity={84} tint="dark" style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
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
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.scroll, contentPadding]}>
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
  firstName,
  setFirstName,
  lastName,
  setLastName,
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
  onContinue,
  onGoogle,
  onDemoAccount
}: {
  authMode: AuthMode;
  setAuthMode: (value: AuthMode) => void;
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
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
  onContinue: () => void;
  onGoogle: () => void;
  onDemoAccount: () => void;
}) {
  return (
    <View style={styles.gapLg}>
      <View style={styles.brandCompact}>
        <View style={styles.loginLogoMark}>
          <Image source={loginLogoImage} style={styles.loginLogoImage} contentFit="contain" />
        </View>
        <Text style={styles.lead} selectable>Poznawaj nowych ludzi codziennie!</Text>
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
        {authMode === "register" && (
                  <View style={styles.nameRow}>
          <TextField label="Imię" value={firstName} onChangeText={setFirstName} />
          <TextField label="Nazwisko" value={lastName} onChangeText={setLastName} />
        </View>

        )}
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="Hasło" value={password} onChangeText={setPassword} secureTextEntry />
        {authMode === "register" && (
          <TextField label="Powtórz hasło" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        )}
        <Pressable accessibilityRole="button" disabled={!firebaseReady || authBusy} onPress={onContinue} style={[styles.primaryButton, (!firebaseReady || authBusy) && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>{authBusy ? "Łączenie..." : authMode === "login" ? "Zaloguj" : "Utwórz konto"}</Text>
        </Pressable>
      </View>

      <View style={styles.socialLoginGrid}>
        <Pressable disabled={!firebaseReady || !googleReady || authBusy} onPress={onGoogle} style={[styles.socialLoginButton, (!firebaseReady || !googleReady || authBusy) && styles.socialLoginButtonDisabled]}>
          <FontAwesome name="google" size={18} color="#fff" />
          <Text style={styles.socialLoginText}>Kontynuuj z Google</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!firebaseReady || authBusy}
        onPress={onDemoAccount}
        style={[styles.secondaryButtonWide, (!firebaseReady || authBusy) && styles.socialLoginButtonDisabled]}
      >
        <Text style={styles.secondaryButtonText}>Konto testowe: tester@spark.app</Text>
      </Pressable>
    </View>
  );
}

function OnboardingScreen({
  intent,
  setIntent,
  ageBand,
  setAgeBand,
  selectedInterests,
  setSelectedInterests,
  canContinue,
  onContinue
}: {
  intent: string;
  setIntent: (value: string) => void;
  ageBand: AgeBand;
  setAgeBand: (value: AgeBand) => void;
  selectedInterests: string[];
  setSelectedInterests: (value: string[]) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const [selectedIntents, setSelectedIntents] = useState([intent]);
  const isDating = selectedIntents.includes("Randki");

  function toggleIntent(label: string) {
    const next = selectedIntents.includes(label) ? selectedIntents.filter((item) => item !== label) : [...selectedIntents, label];

    if (next.length === 0) {
      return;
    }

    setSelectedIntents(next);
    setIntent(next.includes("Randki") ? "Randki" : next[0]);

    if (next.includes("Randki") && ageBand === "under18") {
      setAgeBand(null);
    }
  }

  return (
    <View style={styles.gapLg}>
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Image source={brandLogoImage} style={styles.logoImage} contentFit="cover" />
        </View>
        <Text style={styles.eyebrow} selectable>Start profilu</Text>
        <Text style={styles.screenHeroTitle} selectable>Wybierz swój cel</Text>
        <Text style={styles.lead} selectable>Możesz zaznaczyć kilka opcji. Spark użyje ich do dopasowań, rozmów i rekomendacji profili.</Text>
      </View>

      <View style={styles.intentList}>
        {[
          ["Randki", "Chemia, rozmowy, spotkania", "heart-outline"],
          ["Znajomi", "Kawa, planszówki, miasto", "coffee-outline"],
          ["LGBT+ / Społeczność", "Grupy, wydarzenia, znajomości", "account-group-outline"]
        ].map(([label, description, icon]) => {
          const active = selectedIntents.includes(label);

          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() => toggleIntent(label)}
              style={[styles.intentCard, active && styles.intentCardActive]}
            >
              <View style={styles.intentIcon}>
                <MaterialCommunityIcons name={active ? "check-bold" : icon as any} size={25} color={colors.primaryDeep} />
              </View>
              <View style={styles.fill}>
                <Text style={styles.intentTitle} selectable>{label}</Text>
                <Text style={styles.intentDescription} selectable>{description}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.panelLiquid}>
        <Text style={styles.panelTitle} selectable>Zainteresowania</Text>
        <Text style={styles.panelText} selectable>Wybierz 3-15 tagów. Procent matcha liczymy głównie po wspólnych zainteresowaniach.</Text>
        <CategorizedInterestPicker selected={selectedInterests} onToggle={(item) => setSelectedInterests(toggleListItem(selectedInterests, item))} maxSelected={15} />
      </View>

      <View style={styles.agePanel}>
        <Text style={styles.panelTitle} selectable>Wiek i bezpieczeństwo</Text>
        <Text style={styles.panelText} selectable>
          Randki są tylko dla 18+. Dla znajomych i społeczności można wybrać tryb poniżej 18 lat.
        </Text>
        <View style={styles.ageChoiceRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAgeBand("18+")}
            style={[styles.ageChoice, ageBand === "18+" && styles.ageChoiceActive]}
          >
            <Text style={[styles.ageChoiceTitle, ageBand === "18+" && styles.ageChoiceTitleActive]} selectable>18+</Text>
            <Text style={styles.ageChoiceText} selectable>Randki, znajomi i LGBT+</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isDating}
            onPress={() => setAgeBand("under18")}
            style={[styles.ageChoice, ageBand === "under18" && styles.ageChoiceActive, isDating && styles.ageChoiceDisabled]}
          >
            <Text style={[styles.ageChoiceTitle, ageBand === "under18" && styles.ageChoiceTitleActive]} selectable>Poniżej 18</Text>
            <Text style={styles.ageChoiceText} selectable>Tylko znajomi i społeczność</Text>
          </Pressable>
        </View>
        {isDating && ageBand !== "18+" && (
          <Text style={styles.ageWarning} selectable>Tryb Randki wymaga potwierdzenia 18+.</Text>
        )}
      </View>

      <Pressable accessibilityRole="button" disabled={!canContinue} onPress={onContinue} style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}>
        <Text style={styles.primaryButtonText}>{canContinue ? "Kontynuuj" : "Wybierz 3 tagi i ustaw wiek"}</Text>
      </Pressable>
    </View>
  );
}
function DiscoverScreen({
  mode,
  setMode,
  profile,
  hasPro,
  requestProAccess,
  onSwipe,
  onPremiumChatRequest,
  onOpenMessages,
  reporterName,
  hasMatchedProfile,
  hasRequestedProfile,
  superlikesRemaining,
  selectedInterests,
  setSelectedInterests,
  userAge,
  setUserAge,
  discoverFilters,
  setDiscoverFilters,
  screenMinHeight,
  onReportProfile
}: {
  mode: Mode;
  setMode: (value: Mode) => void;
  profile: MatchProfile;
  hasPro: boolean;
  requestProAccess: () => Promise<boolean>;
  onSwipe: (action: SwipeAction) => void;
  onPremiumChatRequest: () => void;
  onOpenMessages: () => void;
  reporterName: string;
  hasMatchedProfile: boolean;
  hasRequestedProfile: boolean;
  superlikesRemaining: number;
  selectedInterests: string[];
  setSelectedInterests: (value: string[]) => void;
  userAge: number;
  setUserAge: (value: number) => void;
  discoverFilters: DiscoverFilters;
  setDiscoverFilters: React.Dispatch<React.SetStateAction<DiscoverFilters>>;
  screenMinHeight: number;
  onReportProfile: (reason?: string) => void;
}) {
  void userAge;
  void setUserAge;
  void superlikesRemaining;

  const [reportOpen, setReportOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const premiumChatLabel = hasMatchedProfile ? "Chat" : hasRequestedProfile ? "Czeka" : "Napisz teraz";
  const premiumChatSub = hasMatchedProfile ? "Otwórz" : hasRequestedProfile ? "Wysłana" : "Pro";
  const preferenceSummary = [
    { icon: "map-marker", text: profile.distance },
    { icon: "calendar", text: `${discoverFilters.ageMin}-${discoverFilters.ageMax} lat` },
    { icon: "tag-heart", text: `${selectedInterests.length}/15 tagów` },
    { icon: "human-male-height", text: `${discoverFilters.minHeight}-${discoverFilters.maxHeight} cm` }
  ];

  async function runProAction(action: () => void, locked: boolean) {
    if (locked) {
      const granted = await requestProAccess();
      if (!granted) {
        return;
      }
    }

    action();
  }
  function updatePreference(key: keyof DiscoverFilters, value: number | boolean) {
    setDiscoverFilters((current) => ({ ...current, [key]: value }));
  }

  function shiftRange(minKey: keyof DiscoverFilters, maxKey: keyof DiscoverFilters, delta: number, floor: number, ceiling: number) {
    setDiscoverFilters((current) => {
      const min = current[minKey] as number;
      const max = current[maxKey] as number;
      return {
        ...current,
        [minKey]: Math.max(floor, Math.min(ceiling - 1, min + delta)),
        [maxKey]: Math.max(floor + 1, Math.min(ceiling, max + delta))
      };
    });
  }

  async function promptProFeature(kind: "superlike" | "message", action: () => void, locked: boolean) {
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

  function handlePreviewLike() {
    setPreviewOpen(false);
    onSwipe("like");
  }

  function handlePreviewMessage() {
    setPreviewOpen(false);
    handlePremiumChat();
  }

  async function sendReport() {
    const description = reportText.trim();

    if (description.length < 8) {
      Alert.alert("Zgłoszenie", "Opisz problem trochę dokładniej.");
      return;
    }

    const targetName = profile.name + " " + profile.surname;
    const body = [
      "Nowe zgłoszenie w Spark",
      "",
      "Zgłaszający: " + reporterName,
      "Zgłaszany profil: " + targetName,
      "Wiek profilu: " + profile.age,
      "Miasto/profil: " + profile.city + " / " + profile.distance,
      "",
      "Opis problemu:",
      description
    ].join("\n");

    onReportProfile(body);
    setReportOpen(false);
    setReportText("");

    const mailto = "mailto:" + supportEmail + "?subject=" + encodeURIComponent("Zgłoszenie profilu: " + targetName) + "&body=" + encodeURIComponent(body);
    try {
      await Linking.openURL(mailto);
    } catch {
      Alert.alert("Zgłoszenie zapisane", "Nie udało się otworzyć aplikacji mail. Napisz na " + supportEmail + ".");
    }
  }

  return (
    <View style={[styles.discoverScreen, { minHeight: screenMinHeight }]}> 
      <TopBar eyebrow="Odkrywaj" title="Profile" left="=" right="tune-variant" onRightPress={() => setPreferencesOpen(true)} />
      <Pressable accessibilityRole="button" onPress={() => setPreferencesOpen(true)} style={styles.discoverSummaryBar}>
        {preferenceSummary.map((item) => (
          <View key={item.text} style={styles.discoverSummaryPill}>
            <MaterialCommunityIcons name={item.icon as any} size={14} color={colors.primary} />
            <Text style={styles.discoverSummaryText} numberOfLines={1} selectable>{item.text}</Text>
          </View>
        ))}
      </Pressable>

      <View style={styles.stitchMainCanvas}>
        <ProfileCard profile={profile} onOpenPreview={() => setPreviewOpen(true)} onReport={() => setReportOpen(true)} />
      </View>

      <View style={styles.stitchBottomPanel}>
        <View style={styles.stitchFabDock} pointerEvents="box-none">
          <SwipeFab label="Odrzuć" icon="close" onPress={() => onSwipe("pass")} />
          <SwipeFab label="Profil" icon="account" small onPress={() => setPreviewOpen(true)} />
          <SwipeFab label="SPARKLIKE" icon="fire" primary large locked={!hasPro} onPress={() => promptProFeature("superlike", () => onSwipe("superlike"), !hasPro)} />
          <SwipeFab label={premiumChatLabel} sublabel={premiumChatSub} icon="chat" small locked={!hasPro && !hasMatchedProfile} onPress={() => promptProFeature("message", handlePremiumChat, !hasPro && !hasMatchedProfile)} />
          <SwipeFab label="Match" icon="heart" onPress={() => onSwipe("like")} />
        </View>
      </View>

      {previewOpen && (
        <ProfilePreviewSheet
          profile={profile}
          viewerInterests={selectedInterests}
          onClose={() => setPreviewOpen(false)}
          onLike={handlePreviewLike}
          onMessage={handlePreviewMessage}
        />
      )}

      {preferencesOpen && (
        <View style={styles.reportOverlay}>
          <Pressable style={styles.reportBackdrop} onPress={() => setPreferencesOpen(false)} />
          <View style={styles.preferenceSheet}>
            <View style={styles.reportSheetHeader}>
              <View style={styles.fill}>
                <Text style={styles.reportTitle} selectable>Preferencje odkrywania</Text>
                <Text style={styles.reportSubtitle} selectable>Dopasuj osoby po zainteresowaniach, wieku, wzroście i wadze.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setPreferencesOpen(false)} style={styles.reportCloseButton}>
                <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.preferenceScroll}>
              <View style={styles.preferenceSection}>
                <Text style={styles.preferenceLabel} selectable>Zainteresowania</Text>
                <CategorizedInterestPicker selected={selectedInterests} onToggle={(item) => setSelectedInterests(toggleListItem(selectedInterests, item))} maxSelected={15} />
              </View>
              <PreferenceRange label="Wiek" value={`${discoverFilters.ageMin}-${discoverFilters.ageMax} lat`} onMinus={() => shiftRange("ageMin", "ageMax", -1, 18, 70)} onPlus={() => shiftRange("ageMin", "ageMax", 1, 18, 70)} />
              <PreferenceRange label="Wzrost" value={`${discoverFilters.minHeight}-${discoverFilters.maxHeight} cm`} onMinus={() => shiftRange("minHeight", "maxHeight", -5, 140, 220)} onPlus={() => shiftRange("minHeight", "maxHeight", 5, 140, 220)} />
              <PreferenceRange label="Waga" value={`${discoverFilters.minWeight}-${discoverFilters.maxWeight} kg`} onMinus={() => shiftRange("minWeight", "maxWeight", -5, 40, 150)} onPlus={() => shiftRange("minWeight", "maxWeight", 5, 40, 150)} />
              <View style={styles.preferenceToggleRow}>
                <Pressable accessibilityRole="button" onPress={() => updatePreference("nearbyOnly", !discoverFilters.nearbyOnly)} style={[styles.preferenceToggle, discoverFilters.nearbyOnly && styles.preferenceToggleActive]}>
                  <MaterialCommunityIcons name="map-marker-radius" size={17} color={discoverFilters.nearbyOnly ? "#fff" : colors.primary} />
                  <Text style={[styles.preferenceToggleText, discoverFilters.nearbyOnly && styles.preferenceToggleTextActive]}>Blisko mnie</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => updatePreference("proOnly", !discoverFilters.proOnly)} style={[styles.preferenceToggle, discoverFilters.proOnly && styles.preferenceToggleActive]}>
                  <MaterialCommunityIcons name="crown" size={17} color={discoverFilters.proOnly ? "#fff" : colors.primary} />
                  <Text style={[styles.preferenceToggleText, discoverFilters.proOnly && styles.preferenceToggleTextActive]}>Tylko Pro</Text>
                </Pressable>
              </View>
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setPreferencesOpen(false)} style={styles.reportSendButton}>
              <Text style={styles.reportSendText}>Zastosuj preferencje</Text>
            </Pressable>
          </View>
        </View>
      )}
      {reportOpen && (
        <View style={styles.reportOverlay}>
          <Pressable style={styles.reportBackdrop} onPress={() => setReportOpen(false)} />
          <View style={styles.reportSheet}>
            <View style={styles.reportSheetHeader}>
              <View style={styles.fill}>
                <Text style={styles.reportTitle} selectable>Zgłoś profil</Text>
                <Text style={styles.reportSubtitle} selectable>{profile.name} {profile.surname} - wysyłka na {supportEmail}</Text>
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
function PreferenceRange({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.preferenceRangeRow}>
      <View style={styles.fill}>
        <Text style={styles.preferenceLabel} selectable>{label}</Text>
        <Text style={styles.preferenceValue} selectable>{value}</Text>
      </View>
      <View style={styles.preferenceStepper}>
        <Pressable accessibilityRole="button" onPress={onMinus} style={styles.preferenceStepButton}>
          <MaterialCommunityIcons name="minus" size={18} color={colors.ink} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onPlus} style={styles.preferenceStepButton}>
          <MaterialCommunityIcons name="plus" size={18} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}
function ProfileCard({ profile, onOpenPreview, onReport, compact = false }: { profile: MatchProfile; onOpenPreview?: () => void; onReport?: () => void; compact?: boolean }) {
  const featuredInterests = getFeaturedInterests(profile);

  return (
    <Pressable accessibilityRole="button" onPress={onOpenPreview} style={[styles.profileCard, compact && styles.profileCardCompact]}>
      <Image source={profile.image} style={styles.profileImage} contentFit="cover" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.48)", "rgba(0,0,0,0.94)"]} locations={[0, 0.48, 1]} style={styles.cardShade} />
      {onReport && (
        <Pressable accessibilityRole="button" onPress={onReport} style={styles.cardReportButton}>
          <MaterialCommunityIcons name="exclamation-thick" size={17} color="#fff" />
        </Pressable>
      )}
      <View style={styles.badgeRow}>
        {[profile.distance, ...featuredInterests].map((tag, index) => {
          const theme = index === 0 ? null : getInterestTheme(tag, index);

          return (
            <Text
              key={tag}
              style={[styles.badge, theme && { backgroundColor: theme.soft, color: theme.text, borderColor: theme.border }]}
              selectable
            >
              {tag}
            </Text>
          );
        })}
      </View>
      <View style={[styles.profileCopy, compact && styles.profileCopyCompact]}>
        <View style={styles.profileStatusRow}>
          {profile.premium && <Text style={styles.cardCrown} selectable>PRO</Text>}
          <Text style={styles.verified} selectable>{profile.premium ? "Korona Pro" : "Zweryfikowana"}</Text>
          {profile.matchScore && <Text style={styles.matchInlinePill} selectable>{profile.matchScore}%</Text>}
        </View>
        <Text style={styles.cardTitle} numberOfLines={1} selectable>{profile.name} {profile.surname}, {profile.age}</Text>
        {profile.matchScore && (
          <Text style={styles.matchReasonInline} numberOfLines={1} selectable>
            {[profile.city, profile.heightCm ? `${profile.heightCm} cm` : null, ...(profile.matchReasons ?? []).slice(1, 3)].filter(Boolean).join(" • ")}
          </Text>
        )}
        <Text style={styles.cardBio} numberOfLines={compact ? 1 : 2} selectable>{profile.bio}</Text>
        <View style={styles.socialRow}>
          {profile.socials.slice(0, 2).map((social) => {
            const icon = getSocialIcon(social.label);

            return (
              <View key={social.label} style={[styles.socialPill, { borderColor: icon.backgroundColor }]}> 
                <SocialIcon label={social.label} size={13} />
                <Text style={styles.socialPillText} selectable>{social.value}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </Pressable>
  );
}

function ProfilePreviewSheet({
  profile,
  viewerInterests,
  onClose,
  onLike,
  onMessage
}: {
  profile: MatchProfile;
  viewerInterests: string[];
  onClose: () => void;
  onLike: () => void;
  onMessage: () => void;
}) {
  const photos = getProfileGallery(profile);
  const sharedInterests = profile.interests.filter((interest) => viewerInterests.includes(interest));
  const matchBase = Math.max(3, Math.min(15, viewerInterests.length || profile.interests.length || 3));
  const matchPercent = Math.max(12, Math.min(99, Math.round((sharedInterests.length / matchBase) * 100) + (profile.premium ? 4 : 0)));
  const local = StyleSheet.create({
    overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 70, justifyContent: "flex-end" },
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.72)" },
    sheet: { maxHeight: "92%", padding: 16, gap: 14, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: "rgba(12,12,17,0.98)", borderWidth: 1, borderColor: "rgba(255,45,141,0.2)" },
    header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    kicker: { color: colors.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
    title: { marginTop: 3, color: colors.ink, fontSize: 25, lineHeight: 31, fontWeight: "900" },
    close: { width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
    scroller: { marginHorizontal: -16 },
    photo: { width: 332, height: 420, marginHorizontal: 16, borderRadius: 28, overflow: "hidden", backgroundColor: "#111" },
    metrics: { flexDirection: "row", gap: 8 },
    metric: { flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    metricValue: { color: colors.primary, fontSize: 20, fontWeight: "900" },
    metricLabel: { marginTop: 2, color: colors.muted, fontSize: 10, textAlign: "center", fontWeight: "800" },
    bio: { color: "#e4bdc3", fontSize: 14, lineHeight: 21, fontWeight: "700" },
    section: { gap: 9 },
    sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, overflow: "hidden", borderWidth: 1, fontSize: 12, fontWeight: "900" },
    socials: { gap: 8 },
    social: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    socialLabel: { color: colors.ink, fontSize: 12, fontWeight: "900" },
    socialValue: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    actions: { flexDirection: "row", gap: 10 },
    like: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, backgroundColor: colors.primary },
    likeText: { color: "#fff", fontSize: 14, fontWeight: "900" },
    message: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,45,141,0.18)" },
    messageText: { color: colors.primary, fontSize: 14, fontWeight: "900" }
  });

  return (
    <View style={local.overlay}>
      <Pressable style={local.backdrop} onPress={onClose} />
      <View style={local.sheet}>
        <View style={local.header}>
          <View style={styles.fill}>
            <Text style={local.kicker} selectable>Podgląd profilu</Text>
            <Text style={local.title} selectable>{profile.name} {profile.surname}, {profile.age}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={local.close}>
            <MaterialCommunityIcons name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={local.scroller}>
          {photos.map((photo, index) => (
            <Image key={index} source={photo} style={local.photo} contentFit="cover" />
          ))}
        </ScrollView>

        <View style={local.metrics}>
          <View style={local.metric}><Text style={local.metricValue} selectable>{matchPercent}%</Text><Text style={local.metricLabel} selectable>match z zainteresowań</Text></View>
          <View style={local.metric}><Text style={local.metricValue} selectable>{profile.age}</Text><Text style={local.metricLabel} selectable>wiek</Text></View>
          <View style={local.metric}><Text style={local.metricValue} selectable>{profile.distance}</Text><Text style={local.metricLabel} selectable>odległość</Text></View>
        </View>

        <Text style={local.bio} selectable>{profile.bio}</Text>

        <View style={local.section}>
          <Text style={local.sectionTitle} selectable>Wspólne zainteresowania</Text>
          <View style={local.wrap}>
            {(sharedInterests.length > 0 ? sharedInterests : getFeaturedInterests(profile)).slice(0, 6).map((interest, index) => {
              const theme = getInterestTheme(interest, index);

              return <Text key={interest} style={[local.chip, { backgroundColor: theme.soft, color: theme.text, borderColor: theme.border }]} selectable>{interest}</Text>;
            })}
          </View>
        </View>

        <View style={local.section}>
          <Text style={local.sectionTitle} selectable>Sociale</Text>
          <View style={local.socials}>
            {profile.socials.map((social) => (
              <View key={social.label} style={local.social}>
                <SocialIcon label={social.label} size={18} />
                <View style={styles.fill}>
                  <Text style={local.socialLabel} selectable>{social.label}</Text>
                  <Text style={local.socialValue} selectable>{social.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={local.actions}>
          <Pressable accessibilityRole="button" onPress={onLike} style={local.like}>
            <MaterialCommunityIcons name="heart" size={20} color="#fff" />
            <Text style={local.likeText}>Match</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onMessage} style={local.message}>
            <MaterialCommunityIcons name="message-text" size={20} color={colors.primary} />
            <Text style={local.messageText}>Napisz</Text>
          </Pressable>
        </View>
      </View>
    </View>
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
        <MaterialCommunityIcons name={icon as any} size={large ? 40 : small ? 23 : 28} color={primary ? "#fff" : colors.ink} />
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

function MatchesScreen({
  matchedProfileKeys,
  chatRequestKeys
}: {
  matchedProfileKeys: string[];
  chatRequestKeys: string[];
}) {
  const visibleProfiles = matchProfiles.filter((profile) => {
    const key = getProfileKey(profile);
    return matchedProfileKeys.includes(key) || chatRequestKeys.includes(key);
  });

  return (
    <View style={styles.gapLg}>
      <TopBar eyebrow="Match" title="Nowe iskry" left="<" right="+" />
      {visibleProfiles.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle} selectable>Jeszcze bez matchy</Text>
          <Text style={styles.emptyStateText} selectable>
            Polub profil, a gdy druga osoba tez polubi Ciebie, rozmowa pojawi sie w wiadomosciach.
          </Text>
        </View>
      ) : (
        <View style={styles.matchGrid}>
          {visibleProfiles.map((profile) => {
            const key = getProfileKey(profile);
            const isRequest = chatRequestKeys.includes(key) && !matchedProfileKeys.includes(key);

            return (
              <View key={key} style={styles.matchCard}>
                <Image source={profile.image} style={styles.matchImage} contentFit="cover" />
                <Text style={styles.matchName} selectable>{profile.name}, {profile.age}</Text>
                <Text style={styles.matchSubtitle} selectable>
                  {isRequest ? "Prośba o chat wyslana" : profile.interests.slice(0, 2).join(" - ")}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function MessagesScreen({
  matchedProfileKeys,
  chatRequestKeys,
  chatThreads,
  selectedChatKey,
  setSelectedChatKey,
  messageDraft,
  setMessageDraft,
  onSendMessage,
  onBlockProfile,
  onReportProfile
}: {
  matchedProfileKeys: string[];
  chatRequestKeys: string[];
  chatThreads: Record<string, ChatThread>;
  selectedChatKey: string | null;
  setSelectedChatKey: (value: string | null) => void;
  messageDraft: string;
  setMessageDraft: (value: string) => void;
  onSendMessage: (profileKey: string, text: string) => void;
  onBlockProfile: (profileKey: string) => void;
  onReportProfile: (profileKey: string) => void;
}) {
  void messageDraft;
  void setMessageDraft;
  void onSendMessage;
  void onBlockProfile;
  void onReportProfile;

  const [messageView, setMessageView] = useState<"chats" | "requests">("chats");
  const conversations = matchProfiles
    .filter((profile) => {
      const key = getProfileKey(profile);
      return matchedProfileKeys.includes(key) || chatRequestKeys.includes(key) || Boolean(chatThreads[key]);
    })
    .map((profile) => {
      const key = getProfileKey(profile);
      const thread = chatThreads[key];
      const isMatched = matchedProfileKeys.includes(key) || thread?.status === "matched";
      const isBlocked = thread?.status === "blocked";
      const lastMessage = thread?.messages[thread.messages.length - 1]?.text;
      const unreadCount = thread?.status === "matched" ? thread.messages.filter((message) => message.from === "them").length : 0;

      return {
        key,
        profile,
        name: profile.name + " " + profile.surname[0] + ".",
        message: isBlocked
          ? "Profil zablokowany."
          : lastMessage ?? (isMatched ? "Match aktywny - możecie pisać." : thread?.introMessage ?? "Premium prośba o chat czeka na akceptację."),
        time: isMatched ? "teraz" : "oczekuje",
        unreadCount,
        status: (isBlocked ? "blocked" : isMatched ? "matched" : "requested") as ChatStatus
      };
    });
  const requestConversations = conversations.filter((conversation) => conversation.status === "requested");
  const chatConversations = conversations.filter((conversation) => conversation.status !== "requested");
  const unreadChatsCount = chatConversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const visibleConversations = messageView === "chats" ? chatConversations : requestConversations;
  const selectedVisibleKey = visibleConversations.some((conversation) => conversation.key === selectedChatKey) ? selectedChatKey : null;
  const emptyTitle = messageView === "chats" ? "Brak aktywnych chatów" : "Brak nowych próśb";
  const emptyText = messageView === "chats"
    ? "Chat pojawi się tutaj po matchu albo zaakceptowanej prośbie."
    : "Pierwsze wiadomości od profili premium będą czekały tutaj osobno.";

  function selectMessageView(nextView: "chats" | "requests") {
    setMessageView(nextView);
    const nextList = nextView === "chats" ? chatConversations : requestConversations;
    setSelectedChatKey(nextList[0]?.key ?? null);
  }

  return (
    <View style={styles.gapLg}>
      <TopBar eyebrow="Wiadomości" title="Rozmowy" left="=" right="+" />
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
          {messageView === "chats" ? unreadChatsCount + " nieodczytane w chatach" : requestConversations.length + " prośby czekają osobno"}
        </Text>
      </View>
      <View style={styles.searchField}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
        <TextInput placeholder={messageView === "chats" ? "Szukaj chatów" : "Szukaj próśb"} placeholderTextColor={colors.muted} style={styles.searchInput} />
      </View>
      {visibleConversations.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle} selectable>{emptyTitle}</Text>
          <Text style={styles.emptyStateText} selectable>{emptyText}</Text>
        </View>
      ) : (
        <View style={styles.chatList}>
          {visibleConversations.map((conversation) => (
            <Pressable key={conversation.key} onPress={() => setSelectedChatKey(conversation.key)} style={[styles.chatItem, selectedVisibleKey === conversation.key && styles.chatItemActive]}>
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
    </View>
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
  const planCards: Record<SparkPlanId, { label: string; period: string; helper: string; badge?: string }> = {
    weekly: { label: "Tydzień", period: "/ 7 dni", helper: "Dobry start" },
    monthly: { label: "Miesiąc", period: "/ mies.", helper: "Najlepszy wybór" },
    lifetime: { label: "Na zawsze", period: "jednorazowo", helper: "Pełny dostęp", badge: "Best value" }
  };
  const benefitRows = [
    ["ad-off", "Zero reklam", "Przeglądanie profili bez przerw i bez bannerów."],
    ["eye-check", "Zobacz, kto Cię polubił", "Odkrywaj osoby, które już dały Ci swipe."],
    ["message-badge", "Prośba o chat", "Napisz do profilu przed matchem i czekaj na akceptację."],
    ["crown", "Korona Pro", "Widoczny status premium przy Twoim profilu."],
    ["image-multiple", "Do 15 zdjęć", "Więcej miejsca na zdjęcia i lepszy podgląd profilu."],
    ["rocket-launch", "Boost widoczności", "Częstsze pojawianie się u innych w odkrywaniu."],
    ["fire", "10 Superlike miesięcznie", "Więcej wyróżnień dla profili, które naprawdę Cię interesują."],
    ["tune-variant", "Filtry premium", "Lepsze dopasowania po wieku, lokalizacji i zainteresowaniach."]
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
    error: { color: colors.primaryDeep, fontSize: 12, lineHeight: 18, textAlign: "center", fontWeight: "800" }
  });

  async function buySelectedPlan() {
    setBusyAction("purchase");
    const result = await revenueCat.purchasePlan(selectedPlan.id);
    setBusyAction(null);

    if (result.ok) {
      Alert.alert("Spark Pro", "Dostęp premium jest aktywny.");
      return;
    }

    if (!result.cancelled) {
      Alert.alert("Zakup nieudany", result.message);
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
              <Text style={local.tierPrice} numberOfLines={1} selectable>{plan.price}</Text>
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

      {revenueCat.error && <Text style={local.error} selectable>{revenueCat.error}</Text>}
      <Pressable disabled={busyAction !== null || revenueCat.isPro || !hasPackages} onPress={buySelectedPlan} style={[local.primaryCta, (busyAction !== null || revenueCat.isPro || !hasPackages) && local.primaryCtaDisabled]}>
        <MaterialCommunityIcons name={(revenueCat.isPro ? "check" : "star-four-points") as any} size={18} color="#fff" />
        <Text style={local.primaryText}>{revenueCat.isPro ? "Spark Pro aktywny" : busyAction === "purchase" ? "Kupowanie..." : "Kontynuuj za " + selectedPlan.price}</Text>
      </Pressable>    </View>
  );
}
function ProfileScreen({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  selectedInterests,
  setSelectedInterests,
  userAge,
  setUserAge,
  profilePhotos,
  setProfilePhotos,
  pushEnabled,
  setPushEnabled,
  privateProfile,
  setPrivateProfile,
  profileName,
  premiumPlan,
  hasPro,
  openPremium,
  openCustomerCenter,
  openSafety
}: {
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  email: string;
  selectedInterests: string[];
  setSelectedInterests: (value: string[]) => void;
  userAge: number;
  setUserAge: (value: number) => void;
  profilePhotos: ProfilePhoto[];
  setProfilePhotos: (value: ProfilePhoto[]) => void;
  pushEnabled: boolean;
  setPushEnabled: (value: boolean) => void;
  privateProfile: boolean;
  setPrivateProfile: (value: boolean) => void;
  profileName: string;
  premiumPlan: SparkPlanId;
  hasPro: boolean;
  openPremium: () => void;
  openCustomerCenter: () => Promise<{ ok: boolean; message?: string }>;
  openSafety: () => void;
}) {
  const socialLinks = [["Instagram", "@alex.spark"], ["TikTok", "@alexconnects"], ["Spotify", "Pink night walks"], ["LinkedIn", "alex-mercer"]];
  const maxPhotos = hasPro ? 15 : 3;
  const incomingLikeProfiles = matchProfiles.slice(0, 3);
  const [primaryInterests, setPrimaryInterests] = useState(selectedInterests.slice(0, 3));
  const [profilePreviewExpanded, setProfilePreviewExpanded] = useState(false);
  const proCapabilityRows = [
    "Zobacz, kto polubił Twój profil",
    "Wyślij jedną prośbę o chat do profilu",
    "Korona Pro przy zdjęciu profilowym",
    "15 zdjęć profilu zamiast 3",
    "Częstsze pojawianie się na głównej"
  ];
  const previewPhoto = profilePhotos[0] ?? profileImages[4];
  const previewSource = typeof previewPhoto === "string" ? { uri: previewPhoto } : previewPhoto;
  const previewProfile: MatchProfile = {
    name: firstName || "Alex",
    surname: lastName || "Spark",
    age: userAge,
    city: "Twoja okolica",
    bio: "Tak inni zobaczą Twój profil w swipe feedzie.",
    distance: "1 km",
    latitude: 52.2297,
    longitude: 21.0122,
    image: previewSource,
    photos: profilePhotos.map((photo) => (typeof photo === "string" ? { uri: photo } : photo)).slice(0, 3),
    interests: selectedInterests.slice(0, 15),
    featuredInterests: primaryInterests,
    socials: socialLinks.map(([label, value]) => ({ label, value })),
    premium: hasPro,
    matchScore: hasPro ? 96 : 82,
    matchReasons: [`${userAge} lat`, primaryInterests.join(" + ") || "zainteresowania"]
  };
  useEffect(() => {
    setPrimaryInterests((items) => items.filter((item) => selectedInterests.includes(item)).slice(0, 3));
  }, [selectedInterests]);

  function togglePrimaryInterest(item: string) {
    if (!selectedInterests.includes(item)) {
      return;
    }

    if (primaryInterests.includes(item)) {
      setPrimaryInterests(primaryInterests.filter((interest) => interest !== item));
      return;
    }

    if (primaryInterests.length >= 3) {
      Alert.alert("Główne zainteresowania", "Możesz wybrać maksymalnie 3 główne zainteresowania na kartę.");
      return;
    }

    setPrimaryInterests([...primaryInterests, item]);
  }

  async function pickProfilePhoto(index?: number) {
    if (profilePhotos.length >= maxPhotos && index === undefined) {
      Alert.alert("Zdjęcia", hasPro ? "Limit Premium to 15 zdjęć." : "Free ma limit 3 zdjęć. Premium odblokuje 15.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Zdjęcia", "Nadaj dostęp do galerii, aby dodać zdjęcie profilowe.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.88
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    const next = [...profilePhotos];
    if (index !== undefined) {
      next[index] = result.assets[0].uri;
    } else {
      next.push(result.assets[0].uri);
    }
    setProfilePhotos(next.slice(0, maxPhotos));
  }

  return (
    <View style={styles.profileScreen}>
      <TopBar eyebrow="Profil" title="Twoja karta" left="cog-outline" right={pushEnabled ? "bell" : "bell-outline"} onLeftPress={openSafety} onRightPress={() => setPushEnabled(!pushEnabled)} />

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
                <MaterialCommunityIcons name="image-multiple" size={14} color={colors.primary} />
                <Text style={styles.profileMetaText} selectable>{profilePhotos.length}/{maxPhotos}</Text>
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
            <MaterialCommunityIcons name="pencil" size={17} color="#fff" />
            <Text style={styles.profileEditCtaText}>Edytuj zdjęcie główne</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={openPremium} style={styles.profileSecondaryButton}>
            <MaterialCommunityIcons name={hasPro ? "crown" : "lock-open-variant"} size={17} color={colors.primary} />
            <Text style={styles.profileSecondaryButtonText}>{hasPro ? "Spark Pro" : "Odblokuj Pro"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.profileQuickStats}>
        {[["126", "polubień"], ["18", "matchy"], [String(selectedInterests.length), "zainteresowań"]].map(([value, label]) => (
          <View key={label} style={styles.profileQuickStat}>
            <Text style={styles.profileQuickStatValue} selectable>{value}</Text>
            <Text style={styles.profileQuickStatLabel} selectable>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.profilePreviewPanel}>
        <Pressable accessibilityRole="button" onPress={() => setProfilePreviewExpanded((open) => !open)} style={styles.accordionHeader}>
          <View style={styles.fill}>
            <Text style={styles.panelTitle} selectable>Podgląd w Odkrywaj</Text>
            <Text style={styles.photoFormatHint} selectable>Tak inni widzą Twoją kartę podczas swipe.</Text>
          </View>
          <View style={styles.accordionHeaderRight}>
            <Text style={styles.incomingLikesCount} selectable>{primaryInterests.length}/3</Text>
            <MaterialCommunityIcons name={profilePreviewExpanded ? "chevron-up" : "chevron-down"} size={22} color={colors.ink} />
          </View>
        </Pressable>
        {profilePreviewExpanded && (
          <View style={styles.profilePreviewFrame}>
            <ProfileCard profile={previewProfile} compact />
          </View>
        )}
      </View>

      <View style={styles.profileGalleryPanel}>
        <View style={styles.profileGalleryHeader}>
          <View style={styles.fill}>
            <Text style={styles.panelTitle} selectable>Zdjęcia profilu</Text>
            <Text style={styles.photoFormatHint} selectable>{profilePhotos.length}/{maxPhotos} zdjęć - format 4:5 najlepiej działa w Odkrywaj</Text>
          </View>
          <Pressable onPress={() => pickProfilePhoto()} style={styles.photoAddButton}>
            <MaterialCommunityIcons name={profilePhotos.length >= maxPhotos ? "lock" : "plus"} size={16} color="#fff" />
            <Text style={styles.photoAddText}>{profilePhotos.length >= maxPhotos ? "Limit" : "Dodaj"}</Text>
          </Pressable>
        </View>
        <View style={styles.photoGrid}>
          {Array.from({ length: Math.min(maxPhotos, Math.max(3, profilePhotos.length + 1)) }).map((_, index) => {
            const image = profilePhotos[index];
            const source = typeof image === "string" ? { uri: image } : image;

            return (
              <Pressable key={index} onPress={() => pickProfilePhoto(image ? index : undefined)} style={styles.photoSlot}>
                {source ? <Image source={source} style={styles.photoSlotImage} contentFit="cover" /> : <View style={styles.photoEmptyState}><MaterialCommunityIcons name="camera-plus" size={24} color={colors.primary} /></View>}
                <Text style={styles.photoSlotBadge} selectable>{index === 0 ? "Główne" : image ? "Foto " + (index + 1) : "Dodaj"}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.profilePanel}>
        <View style={styles.profileSectionHeader}>
          <View style={styles.fill}>
            <Text style={styles.eyebrow} selectable>Dane osobowe</Text>
            <Text style={styles.profileDescription} selectable>Uzupełnij dane używane w profilu i algorytmie dopasowań.</Text>
          </View>
          <Text style={styles.profilePlanBadge} selectable>{hasPro ? "PRO" : "FREE"}</Text>
        </View>
        <View style={styles.nameRow}>
          <TextField label="Imię" value={firstName} onChangeText={setFirstName} />
          <TextField label="Nazwisko" value={lastName} onChangeText={setLastName} />
        </View>
        <TextField
          label="Wiek do algorytmu"
          value={String(userAge)}
          onChangeText={(value) => setUserAge(Math.max(13, Math.min(99, Number(value.replace(/[^0-9]/g, "")) || 18)))}
          keyboardType="numeric"
        />
        <View style={styles.proFeaturePanel}>
          <View style={styles.proFeatureHeader}>
            <View style={styles.fill}>
              <Text style={styles.panelTitle} selectable>Spark Pro</Text>
              <Text style={styles.proFeatureSubtitle} selectable>{hasPro ? "Aktywne funkcje premium" : "Odblokuj funkcje premium"}</Text>
            </View>
            <Pressable onPress={openPremium} style={styles.proMiniButton}>
              <Text style={styles.proMiniButtonText}>{hasPro ? "Aktywne" : "Upgrade"}</Text>
            </Pressable>
          </View>
          {proCapabilityRows.map((feature) => (
            <View key={feature} style={styles.proFeatureRow}>
              <MaterialCommunityIcons name="check-circle" size={17} color={colors.primary} />
              <Text style={styles.proFeatureText} selectable>{feature}</Text>
            </View>
          ))}
        </View>
        <View style={styles.incomingLikesPanel}>
          <View style={styles.proFeatureHeader}>
            <View style={styles.fill}>
              <Text style={styles.panelTitle} selectable>Polubili Cię</Text>
              <Text style={styles.proFeatureSubtitle} selectable>{hasPro ? "Osoby, które już polubiły Twój profil" : "Dostępne w Spark Pro"}</Text>
            </View>
            <Text style={styles.incomingLikesCount} selectable>{hasPro ? incomingLikeProfiles.length : "Pro"}</Text>
          </View>
          {hasPro ? (
            <View style={styles.incomingLikesRow}>
              {incomingLikeProfiles.map((profile) => (
                <View key={getProfileKey(profile)} style={styles.incomingLikeItem}>
                  <Image source={profile.image} style={styles.incomingLikeImage} contentFit="cover" />
                  <Text style={styles.incomingLikeName} selectable>{profile.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Pressable onPress={openPremium} style={styles.lockedLikesButton}>
              <MaterialCommunityIcons name="lock" size={17} color={colors.primary} />
              <Text style={styles.lockedLikesText} selectable>Zobacz, kto Cię polubił po odblokowaniu Pro</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle} selectable>Zainteresowania</Text>
          <Text style={styles.panelText} selectable>Wybierz maksymalnie 15 zainteresowań. Algorytm liczy match głównie po wspólnych tagach.</Text>
          <CategorizedInterestPicker selected={selectedInterests} onToggle={(item) => setSelectedInterests(toggleListItem(selectedInterests, item))} maxSelected={15} />
          <View style={styles.primaryInterestPanel}>
            <View style={styles.profileGalleryHeader}>
              <View style={styles.fill}>
                <Text style={styles.panelTitle} selectable>Główne na karcie</Text>
                <Text style={styles.panelText} selectable>Wybierz 3 badge widoczne od razu w feedzie.</Text>
              </View>
              <Text style={styles.incomingLikesCount} selectable>{primaryInterests.length}/3</Text>
            </View>
            <View style={styles.chipWrap}>
              {selectedInterests.map((interest, index) => {
                const active = primaryInterests.includes(interest);
                const theme = getInterestTheme(interest, index);

                return (
                  <Pressable key={interest} onPress={() => togglePrimaryInterest(interest)} style={[styles.chip, { backgroundColor: active ? theme.active : theme.soft, borderColor: theme.border }]}>
                    <MaterialCommunityIcons name={active ? "star" : "star-outline"} size={14} color={active ? "#fff" : theme.active} />
                    <Text style={[styles.chipText, { color: active ? "#fff" : theme.text }]}>{interest}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle} selectable>Linki social</Text>
          <View style={styles.socialList}>
            {socialLinks.map(([label, value]) => {
              const icon = getSocialIcon(label);

              return (
                <View key={label} style={styles.socialLinkRow}>
                  <View style={[styles.socialIconBubble, { backgroundColor: icon.backgroundColor }]}>
                    <SocialIcon label={label} size={16} />
                  </View>
                  <View style={styles.socialLinkCopy}>
                    <Text style={styles.settingLabel} selectable>{label}</Text>
                    <Text style={styles.settingValue} selectable>{value}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.settingsList}>
          <View style={styles.settingRow}><Text style={styles.settingLabel} selectable>Powiadomienia push</Text><Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ true: colors.green }} /></View>
          <View style={styles.settingRow}><Text style={styles.settingLabel} selectable>Profil prywatny</Text><Switch value={privateProfile} onValueChange={setPrivateProfile} trackColor={{ true: colors.green }} /></View>
          <SettingRow label="Opcje premium" value="Zobacz" onPress={openPremium} />
          <SettingRow
            label="Zarządzaj subskrypcją"
            value="Customer Center"
            onPress={async () => {
              const result = await openCustomerCenter();
              if (!result.ok && result.message) {
                Alert.alert("Customer Center", result.message);
              }
            }}
          />
          <SettingRow label="Centrum bezpieczeństwa" value="Otwórz" onPress={openSafety} />
          <SettingRow label="Widoczność profilu" value={privateProfile ? "Prywatny" : "Publiczny"} />
        </View>
      </View>
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
            <Text style={[styles.chipText, { color: isSelected ? "#fff" : theme.text }]}>{item}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CategorizedInterestPicker({ selected, onToggle, maxSelected = 15 }: { selected: string[]; onToggle: (item: string) => void; maxSelected?: number }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    interestCategories.reduce<Record<string, boolean>>((state, category, index) => {
      state[category.title] = index < 2;
      return state;
    }, {})
  );

  function handleToggle(item: string) {
    if (!selected.includes(item) && selected.length >= maxSelected) {
      Alert.alert("Zainteresowania", `Możesz wybrać maksymalnie ${maxSelected} zainteresowań.`);
      return;
    }

    onToggle(item);
  }

  return (
    <View style={styles.interestAccordionList}>
      {interestCategories.map((category, categoryIndex) => {
        const isOpen = openSections[category.title] ?? false;
        const selectedInCategory = category.items.filter((item) => selected.includes(item)).length;

        return (
          <View key={category.title} style={styles.interestCategoryCard}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpenSections((current) => ({ ...current, [category.title]: !isOpen }))}
              style={styles.interestCategoryHeader}
            >
              <View style={styles.interestCategoryTitleRow}>
                <MaterialCommunityIcons name={category.icon as any} size={18} color={colors.primary} />
                <View style={styles.fill}>
                  <Text style={styles.interestCategoryTitle} selectable>{category.title}</Text>
                  <Text style={styles.interestCategoryMeta} selectable>{selectedInCategory}/{category.items.length} wybranych</Text>
                </View>
              </View>
              <MaterialCommunityIcons name={isOpen ? "chevron-up" : "chevron-down"} size={22} color={colors.ink} />
            </Pressable>
            {isOpen && (
              <View style={styles.interestCategoryBody}>
                {category.items.map((item, index) => {
                  const isSelected = selected.includes(item);
                  const theme = getInterestTheme(item, categoryIndex * 12 + index);
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
                      <Text style={[styles.chipText, { color: isSelected ? "#fff" : theme.text }]}>{item}</Text>
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
function TextField({ label, value, onChangeText, secureTextEntry = false, keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; keyboardType?: "default" | "email-address" | "numeric" }) {
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
          autoCapitalize="none"
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
  const actions = [
    {
      title: "Zgłoś profil",
      body: "Wyslij zgloszenie do moderacji z ostatnim kontekstem rozmowy.",
      cta: "W feedzie",
      onPress: () => Alert.alert("Zgłoś profil", "Zgłoszenia wysyłasz z karty profilu lub wątku rozmowy.")
    },
    {
      title: "Zablokuj uzytkownika",
      body: "Ukryj profil, przerwij match i zablokuj wiadomosci.",
      cta: "W feedzie",
      onPress: () => Alert.alert("Blokuj", "Blokowanie jest dostępne na karcie profilu i w wiadomościach.")
    },
    {
      title: "Zasady spolecznosci",
      body: "Szacunek, zgoda, prawdziwa tozsamosc i brak nekania.",
      cta: "Czytaj",
      onPress: () => openLegalDocument("Zasady spolecznosci", legalLinks.community, "EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL")
    },
    {
      title: "Prywatnosc i dane",
      body: "Polityka prywatnosci, dane konta, lokalizacja i reklamy.",
      cta: "Otworz",
      onPress: () => openLegalDocument("Polityka prywatnosci", legalLinks.privacy, "EXPO_PUBLIC_PRIVACY_POLICY_URL")
    },
    {
      title: "Regulamin",
      body: "Warunki korzystania, platnosci premium i zasady konta.",
      cta: "Otworz",
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
        <IconButton label="?" />
      </View>

      <View style={styles.safetyHero}>
        <View style={styles.safetyHeroIcon}><MaterialCommunityIcons name={"shield-heart" as any} size={28} color={colors.primaryDeep} /></View>
        <Text style={styles.safetyHeroTitle} selectable>Bezpieczne poznawanie ludzi</Text>
        <Text style={styles.safetyHeroText} selectable>
          Każdy profil może zostać zgłoszony lub zablokowany. Te akcje powinny trafić do backendu moderacji przed publiczną premierą.
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
        <Text style={styles.deleteTitle} selectable>Usuniecie konta w aplikacji</Text>
        <Text style={styles.deleteText} selectable>
          Usunie konto Firebase Auth, glowny profil Firestore i zapisze request do kolejki retencji danych.
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

function IconButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.iconButton}>
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
    flexGrow: 1,
    gap: 24
  },
  discoverScroll: {
    gap: 0
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
    width: 214,
    height: 214
  },
  loginLogoMark: {
    width: 238,
    height: 214,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -18,
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
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center"
  },
  brandCompact: {
    alignItems: "center",
    gap: 4,
    paddingTop: 0
  },
  screenHeroTitle: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39,
    textAlign: "center",
    letterSpacing: 0
  },
  formCard: {
    gap: 14,
    padding: 16,
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
  socialLoginGrid: {
    flexDirection: "row",
    gap: 10
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
    width: "100%",
    gap: 12,
    paddingTop: 8,
    paddingHorizontal: 0,
    paddingBottom: 0
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
    minHeight: 42,
    marginHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 2
  },
  discoverSummaryPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: "rgba(22,20,26,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  discoverSummaryText: {
    minWidth: 0,
    color: colors.ink,
    fontSize: 11,
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
    flex: 1,
    minHeight: 510,
    justifyContent: "flex-end"
  },
  stitchBottomPanel: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 0,
    minHeight: 92,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderRadius: 32,
    backgroundColor: "rgba(7,7,10,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)",
    boxShadow: "0 -12px 42px rgba(0,0,0,0.34)"
  },
  stitchFabDock: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 2
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
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 3
  },
  swipeFabIcon: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(26,26,26,0.64)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.34)"
  },
  swipeFabIconSmall: {
    width: 48,
    height: 48
  },
  swipeFabIconLarge: {
    width: 80,
    height: 80
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
    maxWidth: 78,
    color: colors.ink,
    fontSize: 9,
    lineHeight: 12,
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
    maxWidth: 68,
    marginTop: -2,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 10,
    textAlign: "center",
    fontWeight: "800"
  },
  preferenceSheet: {
    maxHeight: "88%",
    gap: 14,
    padding: 16,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "rgba(12,12,17,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.2)"
  },
  preferenceScroll: {
    gap: 12,
    paddingBottom: 8
  },
  preferenceSection: {
    gap: 10,
    padding: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  preferenceLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  preferenceValue: {
    marginTop: 3,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  preferenceRangeRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  preferenceStepper: {
    flexDirection: "row",
    gap: 8
  },
  preferenceStepButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  preferenceToggleRow: {
    flexDirection: "row",
    gap: 10
  },
  preferenceToggle: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  preferenceToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  preferenceToggleText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  preferenceToggleTextActive: {
    color: "#fff"
  },
  reportOverlay: {
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
    minHeight: 72,
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
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,18,24,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.28)",
    boxShadow: "0 10px 24px rgba(255,45,141,0.1)"
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
    minHeight: 520,
    maxHeight: 760,
    width: "100%",
    overflow: "hidden",
    borderRadius: 32,
    backgroundColor: "#151017",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    boxShadow: "0 30px 78px rgba(0,0,0,0.58)"
  },
  profileCardCompact: {
    minHeight: 500,
    maxHeight: 540
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
    left: 22,
    right: 22,
    bottom: 116,
    zIndex: 5
  },
  profileCopyCompact: {
    bottom: 28
  },
  profileStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 8
  },
  cardCrown: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    color: "#3a2500",
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    fontSize: 11,
    fontWeight: "900"
  },
  verified: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    color: "#fff",
    backgroundColor: "rgba(66,217,130,0.9)",
    fontSize: 11,
    fontWeight: "900"
  },
  cardTitle: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 33,
    textShadowColor: "rgba(0,0,0,0.52)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8
  },
  cardBio: {
    maxWidth: 330,
    marginTop: 7,
    color: "#f0d3dd",
    fontSize: 14,
    lineHeight: 21,
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
  matchReasonInline: {
    maxWidth: 330,
    marginBottom: 5,
    color: "#f5c4d8",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.36)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5
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
  matchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14
  },
  matchCard: {
    width: "48%",
    minHeight: 286,
    overflow: "hidden",
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceStrong,
    boxShadow: "0 16px 34px rgba(99,51,61,0.08)"
  },
  matchImage: {
    width: "100%",
    aspectRatio: 4 / 5
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
    width: "31.5%",
    minWidth: 94,
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
  interestAccordionList: {
    gap: 10
  },
  interestCategoryCard: {
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: "rgba(22,22,29,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.14)"
  },
  interestCategoryHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  interestCategoryTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  interestCategoryTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  interestCategoryMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  interestCategoryBody: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12
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
    borderColor: "rgba(255,45,141,0.2)"
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
    backgroundColor: "rgba(255,45,141,0.22)"
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
