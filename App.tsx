import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Google from "expo-auth-session/providers/google";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { SparkAdBanner, useSwipeInterstitialAds } from "./src/ads";
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
  privacy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || "",
  terms: process.env.EXPO_PUBLIC_TERMS_URL || "",
  community: process.env.EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL || ""
};

function openLegalDocument(title: string, url: string, envName: string) {
  if (!url) {
    Alert.alert(title, `Dodaj ${envName} w .env przed release. Kontakt: ${supportEmail}`);
    return;
  }

  WebBrowser.openBrowserAsync(url).catch(() => {
    Alert.alert(title, `Nie mozna otworzyc linku. Kontakt: ${supportEmail}`);
  });
}
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

type Tab = "discover" | "matches" | "messages" | "premium" | "profile" | "safety";
type Mode = "classic" | "premium";
type AuthMode = "login" | "register";
type SwipeAction = "pass" | "like" | "superlike";
type AgeBand = "18+" | "under18" | null;
type ProfilePhoto = number | string;
type ChatStatus = "matched" | "requested" | "blocked";

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
  interests: string[];
  socials: { label: string; value: string }[];
  premium?: boolean;
  desiredAgeMin?: number;
  desiredAgeMax?: number;
  matchScore?: number;
  matchReasons?: string[];
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

const interestOptions = [
  "Filmy",
  "Natura",
  "Muzyka",
  "Kawa",
  "Sport",
  "Sztuka",
  "Podróże",
  "Gaming",
  "Książki",
  "Kuchnia",
  "Fotografia",
  "Tech",
  "Joga",
  "Koncerty",
  "Planszówki",
  "LGBT+",
  "Taco Hemingway",
  "Mata",
  "Quebonafide",
  "Bedoes",
  "PRO8L3M",
  "OKI",
  "Playboi Carti",
  "Travis Scott",
  "Drake",
  "Kendrick Lamar",
  "The Weeknd",
  "Central Cee"
];

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
    title: "Spark Pro Week",
    price: "Subskrypcja tygodniowa",
    accent: "Dobry test",
    features: ["Zobacz kto polubil Twoj profil", "Premium prosba o chat do profilu", "Korona Pro przy profilowym"]
  },
  {
    id: "monthly",
    title: "Spark Pro Month",
    price: "Subskrypcja miesieczna",
    accent: "Najlepszy rytm",
    features: ["Wszystko z Weekly", "15 zdjec profilu zamiast 3", "Czestsze pojawianie sie na glownej"]
  },
  {
    id: "lifetime",
    title: "Spark Pro Lifetime",
    price: "Jednorazowy zakup",
    accent: "Na stale",
    features: ["Wszystko z Monthly", "Spark Pro na stale", "Zero reklam na zawsze"]
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
  const distanceScore = Math.max(0, 50 - Math.min(distanceKm, 50));
  const ageDelta = Math.abs(params.profile.age - params.userAge);
  const profileAcceptsAge =
    !params.profile.desiredAgeMin ||
    (params.userAge >= params.profile.desiredAgeMin && params.userAge <= (params.profile.desiredAgeMax ?? 99));
  const ageScore = profileAcceptsAge ? Math.max(8, 25 - ageDelta * 2) : Math.max(0, 10 - ageDelta);
  const sharedInterests = params.profile.interests.filter((interest) => params.selectedInterests.includes(interest));
  const interestScore = Math.min(25, sharedInterests.length * 8 + (sharedInterests.length > 0 ? 5 : 0));
  const visibilityBoost = params.profile.premium ? 6 : 0;
  const score = Math.max(1, Math.min(99, Math.round(distanceScore + ageScore + interestScore + visibilityBoost)));
  const reasons = [
    `${Math.max(1, Math.round(distanceKm))} km`,
    profileAcceptsAge ? "wiek pasuje" : "wiek poza preferencja",
    sharedInterests.length > 0 ? sharedInterests.slice(0, 2).join(" + ") : "nowe zainteresowania",
    ...(visibilityBoost > 0 ? ["boost Pro"] : [])
  ];

  return { score, reasons };
}

function getThreadId(uid: string | null | undefined, profileKey: string) {
  return `${uid || "local"}_${profileKey}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [authDone, setAuthDone] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [firstName, setFirstName] = useState("Alex");
  const [lastName, setLastName] = useState("Mercer");
  const [email, setEmail] = useState("alex@spark.app");
  const [password, setPassword] = useState("sparkdemo");
  const [onboarded, setOnboarded] = useState(false);
  const [intent, setIntent] = useState("Randki");
  const [ageBand, setAgeBand] = useState<AgeBand>(null);
  const [selectedInterests, setSelectedInterests] = useState(["Filmy", "Natura", "Kawa", "Sztuka"]);
  const [tab, setTab] = useState<Tab>("discover");
  const [mode, setMode] = useState<Mode>("classic");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [premiumPlan, setPremiumPlan] = useState<SparkPlanId>("monthly");
  const [appUser, setAppUser] = useState<AppAuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const revenueCat = useRevenueCat(appUser?.uid ?? null);
  const trackSwipeAd = useSwipeInterstitialAds(!revenueCat.isPro);
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
    [blockedProfileKeys, selectedInterests, userAge, userLocation]
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
      Alert.alert("Konto testowe", "Zalogowano demo i dodano gotowy match oraz prosbe o chat.");
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
        Alert.alert("Superlike", "Limit 10 zjawiskowych Superlike w tym miesiacu jest juz wykorzystany.");
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
      Alert.alert("Match", `Ty i ${activeProfile.name} polubiliscie sie. Mozecie teraz pisac.`);
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
      Alert.alert("Chat", `Masz juz match z ${activeProfile.name}. Rozmowa jest odblokowana.`);
      setTab("messages");
      return;
    }

    if (hasRequestedActiveProfile) {
      Alert.alert("Prosba wyslana", `Jedna prosba o chat do ${activeProfile.name} juz czeka na akceptacje.`);
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
    Alert.alert("Prosba o chat", `Wyslano jedna premium prosbe do ${activeProfile.name}.`);
  }

  async function sendMessageToProfile(profileKey: string, text: string) {
    const message = text.trim();

    if (!message) {
      return;
    }

    const thread = chatThreads[profileKey];
    if (!thread || thread.status !== "matched") {
      Alert.alert("Chat", "Wiadomosci sa dostepne po matchu albo po zaakceptowaniu prosby.");
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

  function reportProfile(profileKey: string, reason = "Nieodpowiedni profil lub wiadomosc") {
    if (appUser) {
      createReport({
        reporterUid: appUser.uid,
        targetUid: profileKey,
        reason,
        context: "Spark app report"
      }).catch(() => undefined);
    }
    Alert.alert("Zgloszenie", `Zgloszenie trafilo do moderacji: sparkapp@gmail.com`);
  }


  async function performDeleteAccount() {
    if (!appUser) {
      Alert.alert("Usun konto", "Musisz byc zalogowany, aby usunac konto.");
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
      Alert.alert("Konto usuniete", "Konto i glowny profil zostaly usuniete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udalo sie usunac konta.";
      setAuthError(message);
      Alert.alert("Usun konto", message);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert("Usun konto", "To usunie konto logowania i glowny profil. Tej akcji nie mozna cofnac.", [
      { text: "Anuluj", style: "cancel" },
      { text: "Usun", style: "destructive", onPress: () => void performDeleteAccount() }
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
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.scroll, contentPadding]}>
        {tab === "discover" && (
          <DiscoverScreen
            mode={mode}
            setMode={setMode}
            profile={activeProfileWithDistance}
            hasPro={revenueCat.isPro}
            requestProAccess={revenueCat.presentPaywallIfNeeded}
            onSwipe={handleSwipe}
            onPremiumChatRequest={sendPremiumChatRequest}
            hasMatchedProfile={hasMatchedActiveProfile}
            hasRequestedProfile={hasRequestedActiveProfile}
            superlikesRemaining={superlikesRemaining}
            onBlockProfile={() => blockProfile(activeProfileKey)}
            onReportProfile={() => reportProfile(activeProfileKey)}
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
        <SparkAdBanner enabled={!revenueCat.isPro && tab !== "premium"} placement={tab} />
      </ScrollView>

      <BlurView intensity={84} tint="dark" style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {[
          ["discover", "Discover", "✦"],
          ["matches", "Match", "♡"],
          ["messages", "Wiadomosci", "msg"],
          ["premium", "Premium", "✧"],
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

function ScreenFrame({ children, contentPadding }: { children: React.ReactNode; contentPadding: object }) {
  return (
    <LinearGradient colors={["#050507", "#12060e", "#050507"]} style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.scroll, contentPadding]}>
        {children}
      </ScrollView>
    </LinearGradient>
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
        <View style={styles.logoMark}>
          <Text style={styles.logoText} selectable>S</Text>
        </View>
        <Text style={styles.eyebrow} selectable>SPARK SOCIAL</Text>
        <Text style={styles.title} selectable>Spark</Text>
        <Text style={styles.lead} selectable>Randki, znajomi i rozmowy w ciemnym, rozowym flow.</Text>
      </View>

      {!firebaseReady && (
        <View style={styles.configWarning}>
          <Text style={styles.configWarningTitle} selectable>Firebase config required</Text>
          <Text style={styles.configWarningText} selectable>
            Uzupełnij .env wartościami EXPO_PUBLIC_FIREBASE_*. Brakuje: {firebaseMissingConfig.join(", ")}.
          </Text>
        </View>
      )}

      {authError && (
        <View style={styles.configWarning}>
          <Text style={styles.configWarningTitle} selectable>Auth error</Text>
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
          <TextField label="Imie" value={firstName} onChangeText={setFirstName} />
          <TextField label="Nazwisko" value={lastName} onChangeText={setLastName} />
        </View>

        )}
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="Hasło" value={password} onChangeText={setPassword} secureTextEntry />
        <Pressable accessibilityRole="button" disabled={!firebaseReady || authBusy} onPress={onContinue} style={[styles.primaryButton, (!firebaseReady || authBusy) && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>{authBusy ? "Łączenie..." : authMode === "login" ? "Zaloguj" : "Utwórz konto"}</Text>
        </Pressable>
      </View>

      <View style={styles.socialLoginGrid}>
        <Pressable style={styles.socialLoginButton}>
          <Text style={styles.socialLoginText}>Apple</Text>
        </Pressable>
        <Pressable disabled={!firebaseReady || !googleReady || authBusy} onPress={onGoogle} style={[styles.socialLoginButton, (!firebaseReady || !googleReady || authBusy) && styles.socialLoginButtonDisabled]}>
          <Text style={styles.socialLoginText}>Google</Text>
        </Pressable>
        <Pressable style={styles.socialLoginButton}>
          <Text style={styles.socialLoginText}>Instagram</Text>
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
  const isDating = intent === "Randki";

  return (
    <View style={styles.gapLg}>
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText} selectable>S</Text>
        </View>
        <Text style={styles.eyebrow} selectable>Start profilu</Text>
        <Text style={styles.screenHeroTitle} selectable>Znajdz swoj krag</Text>
        <Text style={styles.lead} selectable>Wybierz cel, ustaw bezpieczny tryb wieku i zaznacz kilka zainteresowan dla algorytmu.</Text>
      </View>

      <View style={styles.intentList}>
        {[
          ["Randki", "Chemia, rozmowy, spotkania", "heart"],
          ["Znajomi", "Kawa, planszowki, miasto", "spark"],
          ["LGBT+ / Spolecznosc", "Grupy, wydarzenia, znajomosci", "wave"]
        ].map(([label, description, icon]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            onPress={() => {
              setIntent(label);
              if (label === "Randki" && ageBand === "under18") {
                setAgeBand(null);
              }
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

      <View style={styles.panelLiquid}>
        <Text style={styles.panelTitle} selectable>Zainteresowania</Text>
        <Text style={styles.panelText} selectable>Kolorowe badge pomagaja matchowac profile, rozmowy i wydarzenia. Mozesz wybrac wiele.</Text>
        <InterestChips selected={selectedInterests} onToggle={(item) => setSelectedInterests(toggleListItem(selectedInterests, item))} />
      </View>

      <View style={styles.agePanel}>
        <Text style={styles.panelTitle} selectable>Wiek i bezpieczenstwo</Text>
        <Text style={styles.panelText} selectable>
          Randki sa tylko dla 18+. Dla znajomych i spolecznosci mozna wybrac tryb ponizej 18 lat.
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
            <Text style={[styles.ageChoiceTitle, ageBand === "under18" && styles.ageChoiceTitleActive]} selectable>Ponizej 18</Text>
            <Text style={styles.ageChoiceText} selectable>Tylko znajomi i spolecznosc</Text>
          </Pressable>
        </View>
        {isDating && ageBand !== "18+" && (
          <Text style={styles.ageWarning} selectable>Tryb Randki wymaga potwierdzenia 18+.</Text>
        )}
      </View>

      <Pressable accessibilityRole="button" disabled={!canContinue} onPress={onContinue} style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}>
        <Text style={styles.primaryButtonText}>{canContinue ? "Kontynuuj" : "Wybierz 3 badge i ustaw wiek"}</Text>
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
  hasMatchedProfile,
  hasRequestedProfile,
  superlikesRemaining,
  onBlockProfile,
  onReportProfile
}: {
  mode: Mode;
  setMode: (value: Mode) => void;
  profile: MatchProfile;
  hasPro: boolean;
  requestProAccess: () => Promise<boolean>;
  onSwipe: (action: SwipeAction) => void;
  onPremiumChatRequest: () => void;
  hasMatchedProfile: boolean;
  hasRequestedProfile: boolean;
  superlikesRemaining: number;
  onBlockProfile: () => void;
  onReportProfile: () => void;
}) {
  const premiumChatLabel = hasMatchedProfile ? "Chat" : hasRequestedProfile ? "Czeka" : "Prosba";
  const premiumActions: Array<{ label: string; icon: string; onPress: () => void }> = [
    { label: "Superlike", icon: "pro", onPress: () => onSwipe("superlike") },
    { label: premiumChatLabel, icon: "msg", onPress: onPremiumChatRequest },
    { label: "Zapisz", icon: "save", onPress: () => undefined }
  ];

  return (
    <View style={styles.gapLg}>
      <TopBar eyebrow="Odkrywaj" title="Spark" left="=" right="km" />
      <View style={styles.segmented}>
        {(["classic", "premium"] as Mode[]).map((item) => (
          <Pressable
            key={item}
            onPress={async () => {
              if (item === "premium" && !hasPro) {
                const granted = await requestProAccess();
                if (granted) {
                  setMode(item);
                }
                return;
              }

              setMode(item);
            }}
            style={[styles.segmentButton, mode === item && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{item === "classic" ? "Klasycznie" : "Premium"}</Text>
          </Pressable>
        ))}
      </View>
      <ProfileCard profile={profile} />
      <View style={styles.monetizationStatus}>
        <Text style={styles.monetizationStatusText} selectable>
          {hasPro
            ? `Pro: widzisz kto Cie polubil, prosby o chat, korona, 15 zdjec i boost profilu (${superlikesRemaining}/10 Superlike)`
            : "Free: reklama video co ok. 5-10 swipe'ow, 3 zdjecia i chat dopiero po matchu"}
        </Text>
      </View>
      <View style={styles.profileSafetyRow}>
        <Pressable accessibilityRole="button" onPress={onReportProfile} style={styles.profileSafetyButton}>
          <Text style={styles.profileSafetyText}>Zglos</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onBlockProfile} style={styles.profileSafetyButton}>
          <Text style={styles.profileSafetyText}>Blokuj</Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <RoundAction label="x" tone="light" onPress={() => onSwipe("pass")} />
        <RoundAction label="♡" tone="primary" large onPress={() => onSwipe("like")} />
        <RoundAction label="+" tone="light" onPress={() => onSwipe("superlike")} />
      </View>
      {mode === "premium" && (
        <View style={styles.premiumGrid}>
          {premiumActions.map(({ label, icon, onPress }) => (
            <Pressable key={label} onPress={onPress} style={styles.premiumAction}>
              <Text style={styles.premiumIcon}>{icon}</Text>
              <Text style={styles.premiumText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
function ProfileCard({ profile }: { profile: MatchProfile }) {
  return (
    <View style={styles.profileCard}>
      <Image source={profile.image} style={styles.profileImage} contentFit="cover" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.76)"]} style={styles.cardShade} />
      <View style={styles.badgeRow}>
        {[profile.distance, ...profile.interests.slice(0, 3)].map((tag, index) => {
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
      <View style={styles.profileCopy}>
        {profile.premium && <Text style={styles.cardCrown} selectable>PRO</Text>}
        <Text style={styles.verified} selectable>{profile.premium ? "Korona Pro" : "Zweryfikowana"}</Text>
        {profile.matchScore && (
          <View style={styles.matchScorePill}>
            <Text style={styles.matchScoreText} selectable>{profile.matchScore}% match</Text>
            <Text style={styles.matchReasonText} selectable>{profile.matchReasons?.join(" - ")}</Text>
          </View>
        )}
        <Text style={styles.cardTitle} selectable>{profile.name} {profile.surname}, {profile.age}</Text>
        <Text style={styles.cardBio} selectable>{profile.bio}</Text>
        <View style={styles.socialRow}>
          {profile.socials.map((social) => (
            <Text key={social.label} style={styles.socialPill} selectable>{social.label}: {social.value}</Text>
          ))}
        </View>
      </View>
    </View>
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
                  {isRequest ? "Prosba o chat wyslana" : profile.interests.slice(0, 2).join(" - ")}
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

      return {
        key,
        profile,
        name: `${profile.name} ${profile.surname[0]}.`,
        message: isBlocked
          ? "Profil zablokowany."
          : lastMessage ?? (isMatched ? "Match aktywny - mozecie pisac." : "Premium prosba o chat czeka na akceptacje."),
        time: isMatched ? "teraz" : "oczekuje",
        status: isBlocked ? "blocked" : isMatched ? "matched" : "requested"
      };
    });
  const activeConversation = conversations.find((conversation) => conversation.key === selectedChatKey) ?? conversations[0];
  const activeThread = activeConversation ? chatThreads[activeConversation.key] : null;

  return (
    <View style={styles.gapLg}>
      <TopBar eyebrow="Wiadomosci" title="Rozmowy" left="=" right="+" />
      <View style={styles.searchField}>
        <Text style={styles.searchIcon}>+</Text>
        <TextInput placeholder="Szukaj rozmow" placeholderTextColor={colors.muted} style={styles.searchInput} />
      </View>
      {conversations.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle} selectable>Brak aktywnych rozmow</Text>
          <Text style={styles.emptyStateText} selectable>
            Chat odblokuje sie po matchu. Premium moze wyslac jedna prosbe o rozmowe przed matchem.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.chatList}>
            {conversations.map((conversation) => (
              <Pressable
                key={conversation.key}
                onPress={() => setSelectedChatKey(conversation.key)}
                style={[styles.chatItem, activeConversation?.key === conversation.key && styles.chatItemActive]}
              >
                <Image source={conversation.profile.image} style={styles.chatAvatar} contentFit="cover" />
                <View style={styles.fill}>
                  <Text style={styles.chatName} selectable>{conversation.name}</Text>
                  <Text style={styles.chatMessage} numberOfLines={1} selectable>{conversation.message}</Text>
                </View>
                <Text style={styles.chatTime} selectable>{conversation.time}</Text>
              </Pressable>
            ))}
          </View>

          {activeConversation && (
            <View style={styles.threadPanel}>
              <View style={styles.threadHeader}>
                <View>
                  <Text style={styles.threadTitle} selectable>{activeConversation.name}</Text>
                  <Text style={styles.threadStatus} selectable>
                    {activeConversation.status === "matched" ? "Chat aktywny" : activeConversation.status === "blocked" ? "Zablokowany" : "Prosba oczekuje"}
                  </Text>
                </View>
                <View style={styles.threadActions}>
                  <Pressable onPress={() => onReportProfile(activeConversation.key)} style={styles.threadActionButton}>
                    <Text style={styles.threadActionText}>Zglos</Text>
                  </Pressable>
                  <Pressable onPress={() => onBlockProfile(activeConversation.key)} style={styles.threadActionButton}>
                    <Text style={styles.threadActionText}>Blokuj</Text>
                  </Pressable>
                </View>
              </View>

              {activeConversation.status === "requested" && (
                <View style={styles.requestCard}>
                  <Text style={styles.requestTitle} selectable>Prosba o chat wyslana</Text>
                  <Text style={styles.requestText} selectable>{activeThread?.introMessage ?? "Czeka na akceptacje drugiej osoby."}</Text>
                </View>
              )}

              <View style={styles.messageStack}>
                {(activeThread?.messages ?? []).map((message) => (
                  <View key={message.id} style={[styles.messageBubble, message.from === "me" && styles.messageBubbleMine]}>
                    <Text style={[styles.messageText, message.from === "me" && styles.messageTextMine]} selectable>{message.text}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.messageComposer}>
                <TextInput
                  value={messageDraft}
                  onChangeText={setMessageDraft}
                  placeholder={activeConversation.status === "matched" ? "Napisz wiadomosc" : "Chat zablokowany do czasu matcha"}
                  editable={activeConversation.status === "matched"}
                  placeholderTextColor={colors.muted}
                  style={styles.messageInput}
                />
                <Pressable
                  disabled={activeConversation.status !== "matched"}
                  onPress={() => onSendMessage(activeConversation.key, messageDraft)}
                  style={[styles.messageSendButton, activeConversation.status !== "matched" && styles.messageSendButtonDisabled]}
                >
                  <Text style={styles.messageSendText}>Wyslij</Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
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

  async function buySelectedPlan() {
    setBusyAction("purchase");
    const result = await revenueCat.purchasePlan(selectedPlan.id);
    setBusyAction(null);

    if (result.ok) {
      Alert.alert("Sparknew Pro", "Dostep premium jest aktywny.");
      return;
    }

    if (!result.cancelled) {
      Alert.alert("Zakup nieudany", result.message);
    }
  }

  async function openPaywall() {
    setBusyAction("paywall");
    const granted = await revenueCat.presentPaywallIfNeeded();
    setBusyAction(null);

    if (granted) {
      Alert.alert("Sparknew Pro", "Masz aktywny dostep premium.");
    } else if (revenueCat.error) {
      Alert.alert("Paywall", revenueCat.error);
    }
  }

  async function restore() {
    setBusyAction("restore");
    const result = await revenueCat.restorePurchases();
    setBusyAction(null);

    if (result.ok) {
      Alert.alert("Przywrocono", revenueCat.isPro ? "Sparknew Pro jest aktywny." : "Zakupy zostaly zsynchronizowane.");
    } else {
      Alert.alert("Restore failed", result.message);
    }
  }

  async function manageSubscription() {
    setBusyAction("customer-center");
    const result = await revenueCat.openCustomerCenter();
    setBusyAction(null);

    if (!result.ok) {
      Alert.alert("Customer Center", result.message);
    }
  }

  return (
    <View style={styles.gapLg}>
      <TopBar eyebrow="Premium" title="Sparknew Pro" left="pro" right={revenueCat.isPro ? "on" : "off"} />
      <LinearGradient colors={["#1b0915", "#2a0b1d", "#07070a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premiumHero}>
        <View style={styles.premiumHeroTop}>
          <Text style={styles.premiumHeroKicker} selectable>{revenueCat.isPro ? "Aktywny" : "Upgrade"}</Text>
          <Text style={styles.premiumCrown} selectable>PRO</Text>
        </View>
        <Text style={styles.premiumHeroTitle} selectable>Widzisz kto Cie polubil. Piszesz przed matchem. Masz wiekszy zasieg.</Text>
        <Text style={styles.premiumHeroText} selectable>
          {revenueCatEntitlementId}: lista osob, ktore swipe/like Ciebie, jedna prosba o chat do profilu, korona przy avatarze, 15 zdjec i czestsze pojawianie sie na glownej.
        </Text>
        <View style={styles.premiumBenefitRow}>
          {["Kto mnie polubil", "Prosba o chat", "Korona", "15 zdjec", "Boost"].map((benefit) => (
            <Text key={benefit} style={styles.premiumBenefit} selectable>{benefit}</Text>
          ))}
        </View>
        {revenueCat.error && <Text style={styles.revenueCatError} selectable>{revenueCat.error}</Text>}
      </LinearGradient>
      <View style={styles.planList}>
        {premiumPlans.map((plan) => (
          <Pressable key={plan.id} onPress={() => setPremiumPlan(plan.id)} style={[styles.planCard, premiumPlan === plan.id && styles.planCardActive]}>
            <View style={styles.planHeader}>
              <View style={styles.fill}>
                <Text style={styles.planTitle} selectable>{plan.title}</Text>
                <Text style={styles.planAccent} selectable>{plan.accent}</Text>
              </View>
              <Text style={styles.planPrice} selectable>{plan.price}</Text>
            </View>
            <View style={styles.planFeatures}>
              {plan.features.map((feature) => <Text key={feature} style={styles.planFeature} selectable>+ {feature}</Text>)}
            </View>
          </Pressable>
        ))}
      </View>
      <View style={styles.purchasePanel}>
        <Pressable disabled={busyAction !== null || revenueCat.isPro || !hasPackages} onPress={buySelectedPlan} style={[styles.primaryButton, (busyAction !== null || revenueCat.isPro || !hasPackages) && styles.primaryButtonDisabled]}>
          <Text style={styles.primaryButtonText}>{revenueCat.isPro ? "Sparknew Pro aktywny" : busyAction === "purchase" ? "Kupowanie..." : `Kup ${selectedPlan.title}`}</Text>
        </Pressable>
        {!hasPackages && (
          <Text style={styles.purchaseHint} selectable>
            Brak packages z RevenueCat. Skonfiguruj Offering z produktami Sparkproweek, Sparkpromonth i sparkprolifetime w dashboardzie.
          </Text>
        )}
        <View style={styles.purchaseActionsRow}>
          <Pressable disabled={busyAction !== null} onPress={openPaywall} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{busyAction === "paywall" ? "Ladowanie..." : "RevenueCat Paywall"}</Text>
          </Pressable>
          <Pressable disabled={busyAction !== null} onPress={restore} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{busyAction === "restore" ? "Sync..." : "Restore"}</Text>
          </Pressable>
        </View>
        <Pressable disabled={busyAction !== null} onPress={manageSubscription} style={styles.secondaryButtonWide}>
          <Text style={styles.secondaryButtonText}>{busyAction === "customer-center" ? "Otwieram..." : "Customer Center"}</Text>
        </Pressable>
      </View>
    </View>
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
  const proCapabilityRows = [
    "Zobacz kto swipe/like Twoj profil",
    "Wyslij jedna prosbe o chat do profilu",
    "Korona Pro przy zdjeciu profilowym",
    "15 zdjec profilu zamiast 3",
    "Czestsze pojawianie sie na glownej"
  ];
  const previewPhoto = profilePhotos[0] ?? profileImages[4];
  const previewSource = typeof previewPhoto === "string" ? { uri: previewPhoto } : previewPhoto;
  const previewProfile: MatchProfile = {
    name: firstName || "Alex",
    surname: lastName || "Spark",
    age: userAge,
    city: "Twoja okolica",
    bio: "Tak inni zobacza Twoj profil w swipe feedzie.",
    distance: "1 km",
    latitude: 52.2297,
    longitude: 21.0122,
    image: previewSource,
    interests: selectedInterests.slice(0, 4),
    socials: socialLinks.map(([label, value]) => ({ label, value })),
    premium: hasPro,
    matchScore: hasPro ? 96 : 82,
    matchReasons: ["lokalizacja", "wiek", selectedInterests[0] ?? "zainteresowania"]
  };

  async function pickProfilePhoto(index?: number) {
    if (profilePhotos.length >= maxPhotos && index === undefined) {
      Alert.alert("Zdjecia", hasPro ? "Limit Premium to 15 zdjec." : "Free ma limit 3 zdjec. Premium odblokuje 15.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Zdjecia", "Nadaj dostep do galerii, aby dodac zdjecie profilowe.");
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
    <View style={styles.gapLg}>
      <View style={styles.profileHeroShell}>
        <View style={styles.profileHero}>
          <Image source={previewSource} style={styles.profileHeroImage} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.58)"]} style={styles.profileHeroShade} />
          <View style={styles.profileHeroMeta}>
            <Text style={styles.profileHeroLabel} selectable>Format 4:5</Text>
            <Text style={styles.profileHeroTitle} selectable>{profileName}</Text>
          </View>
          <Pressable onPress={() => pickProfilePhoto(0)} style={styles.editButton}><Text style={styles.editButtonText}>edit</Text></Pressable>
          {hasPro && <Text style={styles.profileHeroCrown} selectable>PRO</Text>}
        </View>
        <Text style={styles.photoFormatHint} selectable>Zdjecia profilu sa przygotowane pod pionowy crop 4:5, idealny dla kart i feedu.</Text>
      </View>
      <View style={styles.photoLimitBar}>
        <Text style={styles.photoFormatHint} selectable>{profilePhotos.length}/{maxPhotos} zdjec profilu</Text>
        <Pressable onPress={() => pickProfilePhoto()} style={styles.photoAddButton}>
          <Text style={styles.photoAddText}>{profilePhotos.length >= maxPhotos ? "Limit" : "Dodaj zdjecie"}</Text>
        </Pressable>
      </View>
      <View style={styles.photoGrid}>
        {Array.from({ length: Math.min(maxPhotos, Math.max(3, profilePhotos.length + 1)) }).map((_, index) => {
          const image = profilePhotos[index];
          const source = typeof image === "string" ? { uri: image } : image;

          return (
            <Pressable key={index} onPress={() => pickProfilePhoto(image ? index : undefined)} style={styles.photoSlot}>
              {source ? <Image source={source} style={styles.photoSlotImage} contentFit="cover" /> : <Text style={styles.photoEmptyText}>+</Text>}
              <Text style={styles.photoSlotBadge} selectable>{index === 0 ? "Glowne" : image ? `Foto ${index + 1}` : "Dodaj"}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.profilePanel}>
        <Text style={styles.eyebrow} selectable>Profil</Text>
        <Text style={styles.profileName} selectable>{profileName}</Text>
        <Text style={styles.profileDescription} selectable>{email} - plan: {hasPro ? premiumPlan : "free + ads"}</Text>
                <View style={styles.nameRow}>
          <TextField label="Imie" value={firstName} onChangeText={setFirstName} />
          <TextField label="Nazwisko" value={lastName} onChangeText={setLastName} />
        </View>
        <TextField
          label="Wiek do algorytmu"
          value={String(userAge)}
          onChangeText={(value) => setUserAge(Math.max(13, Math.min(99, Number(value.replace(/[^0-9]/g, "")) || 18)))}
          keyboardType="numeric"
        />
        <View style={styles.statsRow}>
          {[["126", "polubień"], ["18", "matchy"], [String(selectedInterests.length), "badge"]].map(([value, label]) => (
            <View key={label} style={styles.statBox}><Text style={styles.statValue} selectable>{value}</Text><Text style={styles.statLabel} selectable>{label}</Text></View>
          ))}
        </View>
        <View style={styles.proFeaturePanel}>
          <View style={styles.proFeatureHeader}>
            <View style={styles.fill}>
              <Text style={styles.panelTitle} selectable>Spark Pro</Text>
              <Text style={styles.proFeatureSubtitle} selectable>{hasPro ? "Aktywne funkcje premium" : "Odblokuj funkcje premium"}</Text>
            </View>
            <Pressable onPress={openPremium} style={styles.proMiniButton}>
              <Text style={styles.proMiniButtonText}>{hasPro ? "Pro" : "Upgrade"}</Text>
            </Pressable>
          </View>
          {proCapabilityRows.map((feature) => (
            <Text key={feature} style={styles.proFeatureText} selectable>+ {feature}</Text>
          ))}
        </View>
        <View style={styles.incomingLikesPanel}>
          <View style={styles.proFeatureHeader}>
            <View style={styles.fill}>
              <Text style={styles.panelTitle} selectable>Polubili Cie</Text>
              <Text style={styles.proFeatureSubtitle} selectable>{hasPro ? "Osoby, ktore juz swipe/like Twoj profil" : "Dostepne w Spark Pro"}</Text>
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
              <Text style={styles.lockedLikesText} selectable>Zobacz kto Cie polubil po odblokowaniu Pro</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle} selectable>Zainteresowania</Text>
          <InterestChips selected={selectedInterests} onToggle={(item) => setSelectedInterests(toggleListItem(selectedInterests, item))} />
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle} selectable>Linki social</Text>
          <View style={styles.socialList}>
            {socialLinks.map(([label, value]) => <View key={label} style={styles.socialLinkRow}><Text style={styles.settingLabel} selectable>{label}</Text><Text style={styles.settingValue} selectable>{value}</Text></View>)}
          </View>
        </View>
        <View style={styles.settingsList}>
          <View style={styles.settingRow}><Text style={styles.settingLabel} selectable>Powiadomienia push</Text><Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ true: colors.green }} /></View>
          <View style={styles.settingRow}><Text style={styles.settingLabel} selectable>Profil prywatny</Text><Switch value={privateProfile} onValueChange={setPrivateProfile} trackColor={{ true: colors.green }} /></View>
          <SettingRow label="Opcje premium" value="Zobacz" onPress={openPremium} />
          <SettingRow
            label="Zarzadzaj subskrypcja"
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

function InterestChips({ selected, onToggle }: { selected: string[]; onToggle: (item: string) => void }) {
  return (
    <View style={styles.chipWrap}>
      {interestOptions.map((item, index) => {
        const isSelected = selected.includes(item);
        const theme = getInterestTheme(item, index);

        return (
          <Pressable
            key={item}
            onPress={() => onToggle(item)}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? theme.active : theme.soft,
                borderColor: theme.border
              },
              isSelected && styles.chipActive
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

function TextField({ label, value, onChangeText, secureTextEntry = false, keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; keyboardType?: "default" | "email-address" | "numeric" }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel} selectable>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize="none" placeholderTextColor={colors.muted} style={styles.fieldInput} />
    </View>
  );
}

function SafetyCenter({ onBack, onDeleteAccount }: { onBack: () => void; onDeleteAccount: () => void }) {
  const actions = [
    {
      title: "Zglos profil",
      body: "Wyslij zgloszenie do moderacji z ostatnim kontekstem rozmowy.",
      cta: "W feedzie",
      onPress: () => Alert.alert("Zglos profil", "Zgloszenia wysylasz z karty profilu lub watku rozmowy.")
    },
    {
      title: "Zablokuj uzytkownika",
      body: "Ukryj profil, przerwij match i zablokuj wiadomosci.",
      cta: "W feedzie",
      onPress: () => Alert.alert("Blokuj", "Blokowanie jest dostepne na karcie profilu i w wiadomosciach.")
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
          <Text style={styles.deleteAccountButtonText}>Usun konto</Text>
        </Pressable>
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

function RoundAction({
  label,
  tone,
  large = false,
  onPress
}: {
  label: string;
  tone: "light" | "primary";
  large?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.roundAction, large && styles.roundActionLarge, tone === "primary" && styles.roundActionPrimary]}
    >
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
    boxShadow: "0 24px 58px rgba(255,45,141,0.34)"
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
    color: "#d8b5c7",
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center"
  },
  brandCompact: {
    alignItems: "center",
    gap: 10,
    paddingTop: 4
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
  socialLoginGrid: {
    flexDirection: "row",
    gap: 10
  },
  socialLoginButton: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(22,22,29,0.86)"
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
    borderColor: "rgba(255,45,141,0.18)",
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
    aspectRatio: 4 / 5,
    minHeight: 430,
    maxHeight: 620,
    overflow: "hidden",
    borderRadius: 34,
    borderCurve: "continuous",
    backgroundColor: "#15151c",
    boxShadow: "0 28px 70px rgba(0,0,0,0.5)"
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
    backgroundColor: "rgba(26,26,34,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)",
    fontSize: 13,
    fontWeight: "900"
  },
  profileCopy: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 22
  },
  cardCrown: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    color: "#3a2500",
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.24)",
    fontSize: 12,
    fontWeight: "900"
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
  socialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12
  },
  socialPill: {
    color: colors.ink,
    backgroundColor: "rgba(26,26,34,0.88)",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "800"
  },
  matchScorePill: {
    alignSelf: "flex-start",
    gap: 2,
    marginBottom: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(30,30,38,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)"
  },
  matchScoreText: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  matchReasonText: {
    color: "#d8b5c7",
    fontSize: 10,
    fontWeight: "800"
  },
  profileSafetyRow: {
    flexDirection: "row",
    gap: 10
  },
  profileSafetyButton: {
    flex: 1,
    minHeight: 42,
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
  },  actionRow: {
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
    gap: 12
  },
  planCard: {
    gap: 14,
    padding: 16,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: "rgba(22,22,29,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.18)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.34)"
  },
  planCardActive: {
    borderColor: "rgba(255,45,141,0.38)",
    backgroundColor: "rgba(34,20,31,0.96)",
    boxShadow: "0 20px 44px rgba(255,45,141,0.14)"
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  planTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  planAccent: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
  },
  planPrice: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: "900"
  },
  planFeatures: {
    gap: 6
  },
  planFeature: {
    color: "#d8b5c7",
    fontSize: 13,
    lineHeight: 19
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
  },  emptyStateCard: {
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
  profileHeroShell: {
    gap: 10
  },
  profileHero: {
    aspectRatio: 4 / 5,
    maxHeight: 560,
    overflow: "hidden",
    borderRadius: 34,
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
  },  photoGrid: {
    flexDirection: "row",
    gap: 10
  },
  photoSlot: {
    flex: 1,
    aspectRatio: 4 / 5,
    overflow: "hidden",
    borderRadius: 22,
    borderCurve: "continuous",
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
  },  photoSlotBadge: {
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
    gap: 16
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
    padding: 16,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(26,26,34,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.12)"
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
  proFeatureText: {
    color: "#d8b5c7",
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
    padding: 16,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(34,12,25,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,45,141,0.16)"
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
    borderRadius: 18,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: 48,
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(22,22,29,0.86)"
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
