import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Google from "expo-auth-session/providers/google";
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
import { signInWithEmail, signInWithGoogleIdToken, signUpWithEmail, type AppAuthUser } from "./src/auth";
import { firebaseConfigStatus, isFirebaseConfigured } from "./src/firebase";
import { upsertUserProfile } from "./src/firestore";
import { googleClientIds, isGoogleSignInConfigured } from "./src/google-sign-in";
import { SparkAdBanner, useSwipeInterstitialAds } from "./src/ads";
import { revenueCatEntitlementId, useRevenueCat, type RevenueCatState, type SparkPlanId } from "./src/revenuecat";

WebBrowser.maybeCompleteAuthSession();

const colors = {
  background: "#fbfbfd",
  surface: "rgba(255,255,255,0.78)",
  surfaceStrong: "#ffffff",
  ink: "#1d1d1f",
  muted: "#86868b",
  primary: "#ff2d55",
  primaryDeep: "#ba0034",
  primarySoft: "#ffdada",
  line: "rgba(145,110,111,0.18)",
  green: "#34c759",
  gold: "#b87a00"
};

const profileImages = [
  require("./assets/profiles/profile-1.jpg"),
  require("./assets/profiles/profile-2.jpg"),
  require("./assets/profiles/profile-3.jpg"),
  require("./assets/profiles/profile-4.jpg"),
  require("./assets/profiles/profile-5.jpg"),
  require("./assets/profiles/profile-6.jpg")
];

type Tab = "discover" | "matches" | "messages" | "premium" | "profile" | "safety";
type Mode = "classic" | "premium";
type AuthMode = "login" | "register";
type SwipeAction = "pass" | "like" | "superlike";

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
  "LGBT+"
];

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
    interests: ["Kawa", "Sztuka", "Filmy", "Natura"],
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
    interests: ["Fotografia", "Natura", "Kuchnia", "Podróże"],
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
    interests: ["Muzyka", "Koncerty", "Sport", "Filmy"],
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
    interests: ["Książki", "Sztuka", "Natura", "Joga"],
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
    title: "Sparknew Pro Weekly",
    price: "Subskrypcja tygodniowa",
    accent: "Dobry test",
    features: ["Zero reklam", "10 zjawiskowych Superlike miesiecznie", "Korona Pro na profilu"]
  },
  {
    id: "monthly",
    title: "Sparknew Pro Monthly",
    price: "Subskrypcja miesieczna",
    accent: "Najlepszy rytm",
    features: ["Wszystko z Weekly", "Lepsze motywy profilu", "Czestsze wyskakiwanie u innych"]
  },
  {
    id: "lifetime",
    title: "Sparknew Pro Lifetime",
    price: "Jednorazowy zakup",
    accent: "Na stale",
    features: ["Wszystko z Monthly", "Lifetime bez reklam", "Premium prosba o chat przed matchem"]
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
  const [ageConfirmed, setAgeConfirmed] = useState(false);
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
  const [superlikesRemaining, setSuperlikesRemaining] = useState(10);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">("idle");

  const [, googleResponse, promptGoogleSignIn] = Google.useAuthRequest({
    clientId: googleClientIds.webClientId ?? "firebase-not-configured.apps.googleusercontent.com",
    iosClientId: googleClientIds.iosClientId,
    androidClientId: googleClientIds.androidClientId,
    webClientId: googleClientIds.webClientId,
    responseType: "id_token"
  });

  const isCompact = width < 380;
  const profileName = `${firstName.trim() || "Alex"} ${lastName.trim() || "Mercer"}`;
  const activeProfile = matchProfiles[profileIndex % matchProfiles.length];
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
  const canContinue = ageConfirmed && selectedInterests.length >= 3;

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
      .then((user) => {
        setAppUser(user);
        setEmail(user.email ?? email);
        setAuthDone(true);
      })
      .catch((error: Error) => setAuthError(error.message))
      .finally(() => setAuthBusy(false));
  }, [email, googleResponse]);

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

  async function handleEmailAuth() {
    setAuthBusy(true);
    setAuthError(null);

    try {
      const user =
        authMode === "register"
          ? await signUpWithEmail({ email, password, firstName, lastName })
          : await signInWithEmail(email, password);

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
        interests: selectedInterests,
        premiumPlan: revenueCat.isPro ? premiumPlan : "free",
        privateProfile,
        socials: {
          instagram: "@alex.spark",
          tiktok: "@alexconnects",
          spotify: "Cherry walks",
          linkedin: "alex-mercer"
        }
      });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not save Firestore profile.");
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
    Alert.alert("Prosba o chat", `Wyslano jedna premium prosbe do ${activeProfile.name}.`);
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
          ageConfirmed={ageConfirmed}
          setAgeConfirmed={setAgeConfirmed}
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
    <LinearGradient colors={["#fbfbfd", "#fff4f7"]} style={styles.root}>
      <StatusBar style="dark" />
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
          />
        )}
        {tab === "matches" && <MatchesScreen matchedProfileKeys={matchedProfileKeys} chatRequestKeys={chatRequestKeys} />}
        {tab === "messages" && <MessagesScreen matchedProfileKeys={matchedProfileKeys} chatRequestKeys={chatRequestKeys} />}
        {tab === "premium" && <PremiumScreen premiumPlan={premiumPlan} setPremiumPlan={setPremiumPlan} revenueCat={revenueCat} />}
        {tab === "safety" && <SafetyCenter onBack={() => setTab("profile")} />}
        {tab === "profile" && (
          <ProfileScreen
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            email={email}
            selectedInterests={selectedInterests}
            setSelectedInterests={setSelectedInterests}
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

      <BlurView intensity={72} tint="light" style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {[
          ["discover", "Discover", "✦"],
          ["matches", "Match", "♡"],
          ["messages", "Social", "⌁"],
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
    <LinearGradient colors={["#fbfbfd", "#fff5f7"]} style={styles.root}>
      <StatusBar style="dark" />
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
  onGoogle
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
}) {
  return (
    <View style={styles.gapLg}>
      <View style={styles.brandCompact}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText} selectable>S</Text>
        </View>
        <Text style={styles.eyebrow} selectable>Cherry Blossom Connect</Text>
        <Text style={styles.title} selectable>Spark</Text>
        <Text style={styles.lead} selectable>Logowanie, profile i odkrywanie ludzi w jednym miękkim, mobilnym flow.</Text>
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
            <TextField label="Imię" value={firstName} onChangeText={setFirstName} />
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
    </View>
  );
}

function OnboardingScreen({
  intent,
  setIntent,
  ageConfirmed,
  setAgeConfirmed,
  selectedInterests,
  setSelectedInterests,
  canContinue,
  onContinue
}: {
  intent: string;
  setIntent: (value: string) => void;
  ageConfirmed: boolean;
  setAgeConfirmed: (value: boolean) => void;
  selectedInterests: string[];
  setSelectedInterests: (value: string[]) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  return (
    <View style={styles.gapLg}>
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText} selectable>S</Text>
        </View>
        <Text style={styles.eyebrow} selectable>Start profilu</Text>
        <Text style={styles.screenHeroTitle} selectable>Znajdź to, czego szukasz</Text>
        <Text style={styles.lead} selectable>Wybierz cel, potwierdź wiek i zaznacz minimum trzy zainteresowania.</Text>
      </View>

      <View style={styles.intentList}>
        {[
          ["Randki", "Chemia, rozmowy, spotkania", "♡"],
          ["Znajomi", "Kawa, planszówki, miasto", "✦"],
          ["Społeczność", "LGBT+, grupy, wydarzenia", "⌁"]
        ].map(([label, description, icon]) => (
          <Pressable key={label} accessibilityRole="button" onPress={() => setIntent(label)} style={[styles.intentCard, intent === label && styles.intentCardActive]}>
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

      <View style={styles.panel}>
        <Text style={styles.panelTitle} selectable>Zainteresowania</Text>
        <Text style={styles.panelText} selectable>Te badge pomagają dopasować profile i rozmowy.</Text>
        <InterestChips selected={selectedInterests} onToggle={(item) => setSelectedInterests(toggleListItem(selectedInterests, item))} />
      </View>

      <View style={styles.noticeCard}>
        <View style={styles.fill}>
          <Text style={styles.noticeTitle} selectable>Potwierdzam 18+</Text>
          <Text style={styles.noticeText} selectable>Spark jest dla dorosłych. Akceptuję zasady społeczności i moderację zgłoszeń.</Text>
        </View>
        <Switch value={ageConfirmed} onValueChange={setAgeConfirmed} trackColor={{ true: colors.green }} />
      </View>

      <Pressable accessibilityRole="button" disabled={!canContinue} onPress={onContinue} style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}>
        <Text style={styles.primaryButtonText}>{canContinue ? "Kontynuuj" : "Wybierz 3 badge i potwierdź 18+"}</Text>
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
  superlikesRemaining
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
            ? `Pro: bez reklam, ${superlikesRemaining}/10 Superlike, korona i boost profilu`
            : "Free: reklama video co ok. 5-10 swipe'ow, latwa do pominiecia"}
        </Text>
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
        {[profile.distance, ...profile.interests.slice(0, 3)].map((tag) => (
          <Text key={tag} style={styles.badge} selectable>{tag}</Text>
        ))}
      </View>
      <View style={styles.profileCopy}>
        <Text style={styles.verified} selectable>{profile.premium ? "Premium verified" : "Zweryfikowana"}</Text>
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
  chatRequestKeys
}: {
  matchedProfileKeys: string[];
  chatRequestKeys: string[];
}) {
  const conversations = matchProfiles
    .filter((profile) => {
      const key = getProfileKey(profile);
      return matchedProfileKeys.includes(key) || chatRequestKeys.includes(key);
    })
    .map((profile) => {
      const key = getProfileKey(profile);
      const isMatched = matchedProfileKeys.includes(key);

      return {
        key,
        name: `${profile.name} ${profile.surname[0]}.`,
        message: isMatched ? "Match aktywny - mozecie pisac." : "Premium prosba o chat czeka na akceptacje.",
        time: isMatched ? "teraz" : "oczekuje",
        image: profile.image
      };
    });

  return (
    <View style={styles.gapLg}>
      <TopBar eyebrow="Social" title="Wiadomosci" left="=" right="+" />
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
        <View style={styles.chatList}>
          {conversations.map((conversation) => (
            <Pressable key={conversation.key} style={styles.chatItem}>
              <Image source={conversation.image} style={styles.chatAvatar} contentFit="cover" />
              <View style={styles.fill}>
                <Text style={styles.chatName} selectable>{conversation.name}</Text>
                <Text style={styles.chatMessage} numberOfLines={1} selectable>{conversation.message}</Text>
              </View>
              <Text style={styles.chatTime} selectable>{conversation.time}</Text>
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
      <View style={styles.premiumHero}>
        <Text style={styles.premiumHeroKicker} selectable>{revenueCat.isPro ? "Aktywny" : "Upgrade"}</Text>
        <Text style={styles.premiumHeroTitle} selectable>Bez reklam, wiecej kontroli i szybsze dopasowania.</Text>
        <Text style={styles.premiumHeroText} selectable>
          Entitlement: {revenueCatEntitlementId}. Produkty w RevenueCat: weekly, monthly i lifetime.
        </Text>
        {revenueCat.error && <Text style={styles.revenueCatError} selectable>{revenueCat.error}</Text>}
      </View>
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
              {plan.features.map((feature) => <Text key={feature} style={styles.planFeature} selectable>- {feature}</Text>)}
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
            Brak packages z RevenueCat. Skonfiguruj Offering z produktami weekly, monthly i lifetime w dashboardzie.
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
  const socialLinks = [["Instagram", "@alex.spark"], ["TikTok", "@alexconnects"], ["Spotify", "Cherry walks"], ["LinkedIn", "alex-mercer"]];

  return (
    <View style={styles.gapLg}>
      <View style={styles.profileHero}>
        <Image source={profileImages[4]} style={styles.profileHeroImage} contentFit="cover" />
        <Pressable style={styles.editButton}><Text style={styles.editButtonText}>✎</Text></Pressable>
      </View>
      <View style={styles.profilePanel}>
        <Text style={styles.eyebrow} selectable>Profil</Text>
        <Text style={styles.profileName} selectable>{profileName}</Text>
        <Text style={styles.profileDescription} selectable>{email} - plan: {hasPro ? premiumPlan : "free + ads"}</Text>
        <View style={styles.nameRow}>
          <TextField label="Imię" value={firstName} onChangeText={setFirstName} />
          <TextField label="Nazwisko" value={lastName} onChangeText={setLastName} />
        </View>
        <View style={styles.statsRow}>
          {[["126", "polubień"], ["18", "matchy"], [String(selectedInterests.length), "badge"]].map(([value, label]) => (
            <View key={label} style={styles.statBox}><Text style={styles.statValue} selectable>{value}</Text><Text style={styles.statLabel} selectable>{label}</Text></View>
          ))}
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle} selectable>Zainteresowania</Text>
          <InterestChips selected={selectedInterests} onToggle={(item) => setSelectedInterests(toggleListItem(selectedInterests, item))} />
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle} selectable>Social links</Text>
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
      {interestOptions.map((item) => (
        <Pressable key={item} onPress={() => onToggle(item)} style={[styles.chip, selected.includes(item) && styles.chipActive]}>
          <Text style={[styles.chipText, selected.includes(item) && styles.chipTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function TextField({ label, value, onChangeText, secureTextEntry = false, keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; keyboardType?: "default" | "email-address" }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel} selectable>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize="none" placeholderTextColor={colors.muted} style={styles.fieldInput} />
    </View>
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
    borderColor: "rgba(255,255,255,0.72)"
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
    backgroundColor: "rgba(255,255,255,0.78)",
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
    backgroundColor: "rgba(255,255,255,0.72)"
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
    backgroundColor: "rgba(255,218,218,0.56)",
    borderWidth: 1,
    borderColor: "rgba(255,45,85,0.18)"
  },
  configWarningTitle: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: "900"
  },
  configWarningText: {
    color: "#5d3f40",
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
    borderColor: "rgba(255,255,255,0.72)"
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
    gap: 8
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.74)",
    borderWidth: 1,
    borderColor: "rgba(145,110,111,0.12)"
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: "#5d3f40",
    fontSize: 13,
    fontWeight: "800"
  },
  chipTextActive: {
    color: "#fff"
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
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: "rgba(255,45,85,0.16)"
  },
  secondaryButtonWide: {
    minHeight: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: "rgba(255,45,85,0.16)"
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
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)"
  },
  purchaseActionsRow: {
    flexDirection: "row",
    gap: 10
  },
  purchaseHint: {
    color: "#5d3f40",
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
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,45,85,0.12)"
  },
  monetizationStatusText: {
    color: "#5d3f40",
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
  socialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12
  },
  socialPill: {
    color: colors.ink,
    backgroundColor: "rgba(255,255,255,0.78)",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "800"
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
  premiumHero: {
    gap: 10,
    padding: 22,
    borderRadius: 30,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    boxShadow: "0 18px 42px rgba(99,51,61,0.1)"
  },
  premiumHeroKicker: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  premiumHeroTitle: {
    color: colors.ink,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: 0
  },
  premiumHeroText: {
    color: "#5d3f40",
    fontSize: 14,
    lineHeight: 21
  },
  planList: {
    gap: 12
  },
  planCard: {
    gap: 14,
    padding: 16,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)"
  },
  planCardActive: {
    borderColor: "rgba(255,45,85,0.38)",
    backgroundColor: "rgba(255,255,255,0.94)"
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
    color: "#5d3f40",
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
  emptyStateCard: {
    minHeight: 150,
    justifyContent: "center",
    gap: 8,
    padding: 18,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
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
    backgroundColor: "rgba(255,255,255,0.72)"
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
