import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { palettes, useThemeState, type Palette } from "../theme";
/** Discover context used for accents and badges (Romantic / Friends / Event). */
export type DiscoverMode = "romantic" | "friends" | "event";
export type EventIcon = "music" | "festival" | "party" | "sport" | "culture" | "food" | "outdoor" | "other";

// ─── Modes ───────────────────────────────────────────────────────────────
export const DISCOVER_MODES: readonly { id: DiscoverMode; label: string; icon: string }[] = [
  { id: "romantic", label: "Romantic", icon: "heart" },
  { id: "friends", label: "Friends", icon: "account-group" },
  { id: "event", label: "Event", icon: "ticket-confirmation" }
];

export function modeAccent(palette: Palette, mode: DiscoverMode) {
  return mode === "friends" ? palette.friends : mode === "event" ? palette.event : palette.romantic;
}

export const EVENT_ICON_NAMES: Record<EventIcon, string> = {
  music: "music",
  festival: "party-popper",
  party: "glass-cocktail",
  sport: "basketball",
  culture: "drama-masks",
  food: "food",
  outdoor: "pine-tree",
  other: "calendar-star"
};

const INTEREST_ICONS: Record<string, string> = {
  muzyka: "music", koncerty: "microphone-variant", filmy: "movie-open", "dobre kino": "movie-open", kino: "movie-open",
  kawa: "coffee", kawiarnie: "coffee", sport: "run", bieganie: "run", siłownia: "dumbbell", joga: "yoga",
  sztuka: "palette", design: "brush", moda: "hanger", fotografia: "camera", podróże: "airplane", gaming: "gamepad-variant",
  książki: "book-open-variant", kuchnia: "chef-hat", gotowanie: "chef-hat", tech: "laptop", planszówki: "dice-multiple",
  natura: "leaf", góry: "image-filter-hdr", taniec: "human-female-dance", anime: "star-shooting", rower: "bike",
  tatuaże: "draw", wolontariat: "hand-heart", karaoke: "microphone"
};
export function interestIcon(label: string) {
  return INTEREST_ICONS[label.toLowerCase()] ?? "star-four-points-outline";
}

export const LGBT_LABELS: Record<string, string> = {
  lgbt: "LGBT+", gej: "Gej", lesbijka: "Lesbijka", bi: "Bi", pan: "Pan", queer: "Queer", trans: "Trans",
  niebinarna: "Niebinarna/y", ace: "Ace", aro: "Aro", interseks: "Interseks", szukam: "Szukam siebie"
};

export function formatEventDate(ms: number) {
  const date = new Date(ms);
  const day = date.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}

function useStyles() {
  const theme = useThemeState();
  return { palette: theme.palette, styles: sheets[theme.name] };
}

// ─── Mode switch (big, top centre) ───────────────────────────────────────
export const ModeSwitch = memo(function ModeSwitch({ mode, onChange }: { mode: DiscoverMode; onChange: (mode: DiscoverMode) => void }) {
  const { palette, styles } = useStyles();
  const [width, setWidth] = useState(0);
  const index = DISCOVER_MODES.findIndex((item) => item.id === mode);
  const position = useRef(new Animated.Value(index)).current;
  const segment = width > 0 ? (width - 8) / DISCOVER_MODES.length : 0;

  useEffect(() => {
    Animated.spring(position, { toValue: index, useNativeDriver: Platform.OS !== "web", speed: 18, bounciness: 6 }).start();
  }, [index, position]);

  return (
    <View style={styles.switchWrap} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} accessibilityRole="tablist">
      {segment > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.switchIndicator,
            { width: segment, backgroundColor: modeAccent(palette, mode), transform: [{ translateX: Animated.multiply(position, segment) }] }
          ]}
        />
      )}
      {DISCOVER_MODES.map((item) => {
        const active = item.id === mode;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Tryb ${item.label}`}
            onPress={() => onChange(item.id)}
            style={styles.switchItem}
          >
            <MaterialCommunityIcons name={item.icon as any} size={15} color={active ? palette.onPrimary : palette.muted} />
            <Text style={[styles.switchText, active && styles.switchTextActive]} numberOfLines={1}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

// ─── Header (logo + filters) ─────────────────────────────────────────────
const wordmark = require("../../assets/spark-wordmark.png");

export type HeaderAction = { icon: string; label: string; onPress: () => void; dot?: boolean };

export function DiscoverHeader({ onFilters, filtersActive, left, actions = [] }: { onFilters?: () => void; filtersActive?: boolean; left?: HeaderAction; actions?: HeaderAction[] }) {
  const { palette, styles } = useStyles();
  const right: HeaderAction[] = [...actions, ...(onFilters ? [{ icon: "tune-variant", label: "Preferencje i filtry", onPress: onFilters, dot: filtersActive }] : [])];
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {left && (
          <Pressable accessibilityRole="button" accessibilityLabel={left.label} onPress={left.onPress} style={styles.roundGlass}>
            <MaterialCommunityIcons name={left.icon as any} size={19} color={palette.ink} />
            {left.dot && <View style={styles.roundGlassDot} />}
          </Pressable>
        )}
        <Image source={wordmark} style={styles.wordmark} contentFit="contain" accessibilityLabel="Spark" />
      </View>
      <View style={styles.headerRight}>
        {right.map((action) => (
          <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={styles.roundGlass}>
            <MaterialCommunityIcons name={action.icon as any} size={19} color={palette.ink} />
            {action.dot && <View style={styles.roundGlassDot} />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Event strip (Event mode) ────────────────────────────────────────────
export function EventStrip({ events, onOpen }: { events: { id: string; title: string; icon: EventIcon; startsAtMs: number }[]; onOpen: () => void }) {
  const { palette, styles } = useStyles();
  return (
    <View style={styles.eventStrip}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={[styles.eventChip, styles.eventChipAdd]}>
        <MaterialCommunityIcons name="calendar-plus" size={16} color={palette.onPrimary} />
        <Text style={styles.eventChipAddText}>Wydarzenia</Text>
      </Pressable>
      {events.slice(0, 3).map((event) => (
        <Pressable key={event.id} accessibilityRole="button" onPress={onOpen} style={styles.eventChip}>
          <MaterialCommunityIcons name={EVENT_ICON_NAMES[event.icon] as any} size={15} color={palette.event} />
          <Text style={styles.eventChipText} numberOfLines={1}>{event.title}</Text>
        </Pressable>
      ))}
      {events.length > 3 && <Text style={styles.eventMore}>+{events.length - 3}</Text>}
    </View>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────
export type DeckCardData = {
  key: string;
  name: string;
  age: number;
  place: string;
  photos: any[];
  chips: string[];
  verified: boolean;
  premium: boolean;
  lgbt?: string[] | null;
  events?: string[];
  note?: string | null;
  /** One emphasised chip, e.g. "Łączy Was: Planszówki". */
  highlight?: { icon: string; label: string } | null;
  /** Small line under the place, e.g. "58% dopasowania · Randki". */
  meta?: string | null;
};

type Stamps = { like: Animated.AnimatedInterpolation<number>; pass: Animated.AnimatedInterpolation<number>; superlike: Animated.AnimatedInterpolation<number> };

export const DeckCard = memo(function DeckCard({ data, mode, onOpenDetails, onReport, stamps, position }: {
  data: DeckCardData;
  mode: DiscoverMode;
  onOpenDetails?: () => void;
  onReport?: () => void;
  stamps?: Stamps;
  position?: { index: number; total: number };
}) {
  const { palette, styles } = useStyles();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const photos = data.photos.length ? data.photos : [null];
  const photo = photos[Math.min(photoIndex, photos.length - 1)];
  const accent = modeAccent(palette, mode);
  const counter = position ?? { index: photoIndex, total: photos.length };

  useEffect(() => setPhotoIndex(0), [data.key]);

  function handlePress(locationX: number) {
    // Tinder-style: tap the edges to flip photos, the middle opens the profile.
    if (cardWidth > 0 && photos.length > 1 && locationX < cardWidth * 0.3) { setPhotoIndex((value) => Math.max(0, value - 1)); return; }
    if (cardWidth > 0 && photos.length > 1 && locationX > cardWidth * 0.7) { setPhotoIndex((value) => Math.min(photos.length - 1, value + 1)); return; }
    onOpenDetails?.();
  }

  return (
    <View style={styles.card} onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${data.name}, ${data.age}. Dotknij, aby zobaczyć profil`}
        onPress={(event) => handlePress(event.nativeEvent.locationX)}
        style={StyleSheet.absoluteFill}
      >
      {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} recyclingKey={`${data.key}-${photoIndex}`} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.photoPlaceholder }]} />}
      <LinearGradient pointerEvents="none" colors={[palette.glassStrong, palette.glass, "transparent"]} locations={[0, 0.5, 1]} style={styles.cardTopFade} />
      <LinearGradient pointerEvents="none" colors={["transparent", palette.glass, palette.glassStrong]} locations={[0, 0.55, 1]} style={styles.cardBottomFade} />

      <View pointerEvents="box-none" style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{data.name}, {data.age}</Text>
          {data.verified && (
            <View style={[styles.verifiedBadge, { backgroundColor: accent }]} accessibilityLabel="Zweryfikowany profil">
              <MaterialCommunityIcons name="check" size={13} color={palette.onPrimary} />
            </View>
          )}
          <View style={styles.fill} />
          {counter.total > 1 && <Text style={styles.cardCounter}>{String(counter.index + 1).padStart(2, "0")} / {String(counter.total).padStart(2, "0")}</Text>}
        </View>
        <View style={styles.cardPlaceRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={15} color={palette.inkSoft} />
          <Text style={styles.cardPlace} numberOfLines={1}>{data.place}</Text>
        </View>
        {!!data.meta && <Text style={styles.cardMeta} numberOfLines={1}>{data.meta}</Text>}
        <View style={styles.chipRow}>
          {data.highlight && (
            <View style={[styles.glassChip, { borderColor: accent }]}>
              <MaterialCommunityIcons name={data.highlight.icon as any} size={13} color={accent} />
              <Text style={styles.glassChipText} numberOfLines={1}>{data.highlight.label}</Text>
            </View>
          )}
          {data.events?.slice(0, 1).map((title) => (
            <View key={title} style={[styles.glassChip, { borderColor: palette.event }]}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={13} color={palette.event} />
              <Text style={styles.glassChipText} numberOfLines={1}>Też idzie: {title}</Text>
            </View>
          ))}
          {!!data.lgbt?.length && (
            <View style={styles.glassChip}>
              <Text style={styles.rainbow}>🏳️‍🌈</Text>
              <Text style={styles.glassChipText} numberOfLines={1}>{data.lgbt.map((item) => LGBT_LABELS[item] ?? item).join(" · ")}</Text>
            </View>
          )}
          {data.chips.slice(0, data.highlight || data.events?.length || data.lgbt?.length ? 1 : 2).map((label) => (
            <View key={label} style={styles.glassChip}>
              <MaterialCommunityIcons name={interestIcon(label) as any} size={13} color={palette.inkSoft} />
              <Text style={styles.glassChipText} numberOfLines={1}>{label}</Text>
            </View>
          ))}
        </View>
        {!!data.note && <Text style={styles.cardNote} numberOfLines={1}>{data.note}</Text>}
      </View>
      </Pressable>

      {onReport && (
        <Pressable accessibilityRole="button" accessibilityLabel="Zgłoś profil" onPress={onReport} hitSlop={8} style={styles.reportButton}>
          <MaterialCommunityIcons name="flag-outline" size={14} color={palette.inkSoft} />
        </Pressable>
      )}

      {stamps && <SwipeEffects stamps={stamps} />}
    </View>
  );
});

// ─── Swipe effects (no words) ─────────────────────────────────────────────
// Everything is driven by the drag itself (opacity/transform only, no blur,
// no layout work per frame). The only loop is a small flame flicker that
// runs on the native driver.
const EMBERS = [
  { left: "8%", size: 30, from: 0.15, color: "#ff6a1a" },
  { left: "30%", size: 40, from: 0.3, color: "#ff9a1f" },
  { left: "54%", size: 32, from: 0.2, color: "#ff5a1f" },
  { left: "76%", size: 44, from: 0.38, color: "#ffb02e" }
] as const;
const FLOAT_HEARTS = [
  { left: "14%", size: 20, from: 0.3 },
  { left: "74%", size: 26, from: 0.4 },
  { left: "58%", size: 16, from: 0.55 }
] as const;

function SwipeEffects({ stamps }: { stamps: Stamps }) {
  const { styles } = useStyles();
  const flicker = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const native = Platform.OS !== "web";
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flicker, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      Animated.timing(flicker, { toValue: 0, duration: 460, easing: Easing.inOut(Easing.quad), useNativeDriver: native })
    ]));
    loop.start();
    return () => loop.stop();
  }, [flicker]);
  const flickerScale = flicker.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const flickerGlow = flicker.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });
  const { pass, like, superlike } = stamps;

  return (
    <View pointerEvents="none" style={styles.fxFill}>
      {/* Left: the card warms up to red and starts to burn from the bottom. */}
      <Animated.View style={[styles.fxFill, { opacity: pass.interpolate({ inputRange: [0, 1], outputRange: [0, 0.78] }) }]}>
        <LinearGradient colors={["rgba(255,45,45,0.5)", "rgba(196,8,30,0.96)"]} style={styles.fxFill} />
      </Animated.View>
      <Animated.View style={[styles.fxFire, { opacity: pass, transform: [{ translateY: pass.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) }] }]}>
        <Animated.View style={[styles.fxFill, { opacity: flickerGlow }]}>
          <LinearGradient colors={["transparent", "rgba(255,70,20,0.6)", "rgba(255,150,30,0.95)", "rgba(255,200,60,1)"]} locations={[0, 0.45, 0.8, 1]} style={styles.fxFill} />
        </Animated.View>
      </Animated.View>
      {EMBERS.map((ember) => (
        <Animated.View
          key={ember.left}
          style={[styles.fxEmber, {
            left: ember.left,
            opacity: pass.interpolate({ inputRange: [ember.from, Math.min(1, ember.from + 0.35)], outputRange: [0, 1], extrapolate: "clamp" }),
            transform: [{ translateY: pass.interpolate({ inputRange: [ember.from, 1], outputRange: [24, -ember.size * 1.6], extrapolate: "clamp" }) }]
          }]}
        >
          <Animated.View style={{ transform: [{ scale: flickerScale }] }}>
            <MaterialCommunityIcons name="fire" size={ember.size} color={ember.color} />
          </Animated.View>
        </Animated.View>
      ))}

      {/* Right: soft white-pink light and one clean heart. */}
      <Animated.View style={[styles.fxFill, { opacity: like.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }) }]}>
        <LinearGradient colors={["rgba(255,255,255,0.85)", "rgba(255,214,234,0.9)"]} style={styles.fxFill} />
      </Animated.View>
      <Animated.View style={[styles.fxCenter, {
        opacity: like.interpolate({ inputRange: [0.12, 0.6], outputRange: [0, 1], extrapolate: "clamp" }),
        transform: [{ scale: like.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.55, 1.06, 1], extrapolate: "clamp" }) }]
      }]}>
        <View style={styles.fxHalo}>
          <MaterialCommunityIcons name="heart" size={78} color="#ff2d8d" />
        </View>
      </Animated.View>
      {FLOAT_HEARTS.map((heart) => (
        <Animated.View
          key={heart.left}
          style={[styles.fxFloat, {
            left: heart.left,
            opacity: like.interpolate({ inputRange: [heart.from, Math.min(1, heart.from + 0.3)], outputRange: [0, 0.9], extrapolate: "clamp" }),
            transform: [{ translateY: like.interpolate({ inputRange: [heart.from, 1], outputRange: [20, -90], extrapolate: "clamp" }) }]
          }]}
        >
          <MaterialCommunityIcons name="heart" size={heart.size} color="#ff7eb6" />
        </Animated.View>
      ))}

      {/* Up (SparkLike): a pink glow from the top and a spark. */}
      <Animated.View style={[styles.fxFill, { opacity: superlike.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) }]}>
        <LinearGradient colors={["rgba(255,45,141,0.85)", "rgba(255,255,255,0.2)"]} style={styles.fxFill} />
      </Animated.View>
      <Animated.View style={[styles.fxCenter, {
        opacity: superlike,
        transform: [{ scale: superlike.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }]
      }]}>
        <View style={styles.fxHalo}>
          <Animated.View style={{ transform: [{ scale: flickerScale }] }}>
            <MaterialCommunityIcons name="star-four-points" size={70} color="#ff2d8d" />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

/** Decorative frames behind the deck (the stacked-cards look). */
export function DeckBackdrop() {
  const { styles } = useStyles();
  return (
    <>
      <View pointerEvents="none" style={styles.backFrame} />
    </>
  );
}

// ─── Glass action bar ────────────────────────────────────────────────────
export type ActionItem = { key: string; label: string; icon: string; onPress: () => void; locked?: boolean; primary?: boolean };

export function GlassActionBar({ items, disabled, mode }: { items: ActionItem[]; disabled: boolean; mode: DiscoverMode }) {
  const { palette, styles } = useStyles();
  const accent = modeAccent(palette, mode);
  return (
    <View style={styles.actionBarShadow}>
      <GlassSurface style={styles.actionBar}>
        {items.map((item) => {
          const like = item.primary === true;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              disabled={disabled}
              onPress={item.onPress}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed, disabled && styles.actionButtonDisabled]}
            >
              <View style={[styles.actionIconWrap, like && { backgroundColor: `${accent}2e` }]}>
                <MaterialCommunityIcons name={item.icon as any} size={like ? 26 : 24} color={like ? accent : palette.ink} />
                {item.locked && <View style={styles.actionLock}><MaterialCommunityIcons name="lock" size={8} color="#fff" /></View>}
              </View>
              <Text style={[styles.actionLabel, like && { color: accent }]} numberOfLines={1}>{item.label}</Text>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}

/** Real blur on iOS; elsewhere a solid frosted colour (blur there is costly or unsupported). */
export function GlassSurface({ style, children, intensity = 40 }: { style: any; children: React.ReactNode; intensity?: number }) {
  const { palette } = useStyles();
  if (Platform.OS === "ios") return <BlurView intensity={intensity} tint={palette.blurTint} style={style}>{children}</BlurView>;
  return <View style={[style, { backgroundColor: palette.name === "light" ? "rgba(255,255,255,0.92)" : "rgba(24,18,26,0.94)" }]}>{children}</View>;
}

// ─── Notices (empty deck, mode off, pick events) ─────────────────────────
export function DiscoverNotice({ icon, title, text, actionLabel, onAction, secondaryLabel, onSecondary, loading, mode }: {
  icon: string; title: string; text: string; actionLabel?: string; onAction?: () => void;
  secondaryLabel?: string; onSecondary?: () => void; loading?: boolean; mode: DiscoverMode;
}) {
  const { palette, styles } = useStyles();
  const accent = modeAccent(palette, mode);
  return (
    <View style={styles.notice}>
      <View style={[styles.noticeIcon, { backgroundColor: palette.primarySoft }]}>
        {loading ? <ActivityIndicator color={accent} size="large" /> : <MaterialCommunityIcons name={icon as any} size={38} color={accent} />}
      </View>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeText}>{text}</Text>
      {actionLabel && onAction && (
        <Pressable accessibilityRole="button" onPress={onAction} style={[styles.noticeButton, { backgroundColor: accent }]}>
          <Text style={styles.noticeButtonText}>{actionLabel}</Text>
        </Pressable>
      )}
      {secondaryLabel && onSecondary && (
        <Pressable accessibilityRole="button" onPress={onSecondary} style={styles.noticeSecondary}>
          <Text style={[styles.noticeSecondaryText, { color: accent }]}>{secondaryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles (one sheet per theme, built once) ────────────────────────────
function createStyles(c: Palette) {
  const glassShadow = c.name === "light" ? "0 8px 24px rgba(150,60,120,0.10)" : "0 8px 24px rgba(0,0,0,0.35)";
  return StyleSheet.create({
    fill: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    wordmark: { width: 108, height: 46 },
    roundGlass: {
      width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
      backgroundColor: c.glass, borderWidth: 1, borderColor: c.glassBorder
    },
    roundGlassDot: { position: "absolute", top: 9, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: c.primary },

    switchWrap: {
      flexDirection: "row", padding: 3, borderRadius: 22, backgroundColor: c.glass,
      borderWidth: 1, borderColor: c.glassBorder
    },
    switchIndicator: { position: "absolute", top: 3, left: 3, bottom: 3, borderRadius: 19 },
    switchItem: { flex: 1, minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4 },
    switchText: { color: c.muted, fontSize: 14, fontWeight: "700", letterSpacing: 0.1 },
    switchTextActive: { color: c.onPrimary },

    eventStrip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 30 },
    eventChip: {
      flexShrink: 1, maxWidth: 150, flexDirection: "row", alignItems: "center", gap: 5, height: 30, paddingHorizontal: 11,
      borderRadius: 15, backgroundColor: c.glass, borderWidth: 1, borderColor: c.glassBorder
    },
    eventChipAdd: { backgroundColor: c.event, borderColor: c.event, flexShrink: 0 },
    eventChipAddText: { color: c.onPrimary, fontSize: 12, fontWeight: "700" },
    eventChipText: { flexShrink: 1, color: c.ink, fontSize: 12, fontWeight: "600" },
    eventMore: { color: c.muted, fontSize: 13, fontWeight: "800" },

    card: {
      flex: 1, overflow: "hidden", borderRadius: 30, backgroundColor: c.photoPlaceholder,
      borderWidth: 1, borderColor: c.glassBorder, boxShadow: c.name === "light" ? "0 12px 32px rgba(150,60,120,0.14)" : "0 12px 32px rgba(0,0,0,0.45)"
    },
    cardTopFade: { position: "absolute", top: 0, left: 0, right: 0, height: "30%" },
    cardBottomFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: "24%" },
    cardHeader: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 20, gap: 4 },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    cardName: { flexShrink: 1, color: c.ink, fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.6 },
    verifiedBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    cardCounter: { color: c.muted, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"], letterSpacing: 1 },
    cardPlaceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    cardPlace: { flexShrink: 1, color: c.inkSoft, fontSize: 15, fontWeight: "500" },
    cardMeta: { color: c.muted, fontSize: 12, fontWeight: "600" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
    glassChip: {
      maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 5, height: 30, paddingHorizontal: 11,
      borderRadius: 15, backgroundColor: c.glass, borderWidth: 1, borderColor: c.glassBorder
    },
    glassChipText: { flexShrink: 1, color: c.ink, fontSize: 13, fontWeight: "600" },
    rainbow: { fontSize: 12 },
    cardNote: { color: c.muted, fontSize: 11, fontWeight: "600", marginTop: 2 },
    reportButton: {
      position: "absolute", right: 14, top: 52, width: 30, height: 30, borderRadius: 15,
      alignItems: "center", justifyContent: "center", backgroundColor: c.glass, borderWidth: 1, borderColor: c.glassBorder
    },
    fxFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    fxFire: { position: "absolute", left: 0, right: 0, bottom: 0, height: "64%" },
    fxEmber: { position: "absolute", bottom: 128 },
    fxCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
    fxHalo: { width: 148, height: 148, borderRadius: 74, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.88)" },
    fxFloat: { position: "absolute", bottom: 150 },
    stamp: { position: "absolute", top: "40%", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 4, backgroundColor: "rgba(255,255,255,0.14)" },
    stampLike: { left: 26, transform: [{ rotate: "-14deg" }] },
    stampPass: { right: 26, borderColor: "#ff4d5e", transform: [{ rotate: "14deg" }] },
    stampSuper: { alignSelf: "center", left: "30%", borderColor: "#3db6ff", top: "52%" },
    stampText: { fontSize: 34, fontWeight: "900", letterSpacing: 2 },
    stampPassText: { color: "#ff4d5e" },
    stampSuperText: { color: "#3db6ff" },

    backFrame: { position: "absolute", top: -8, left: 22, right: 22, bottom: 40, borderRadius: 30, backgroundColor: c.glass, borderWidth: 1, borderColor: c.glassBorder, opacity: 0.7 },

    actionBarShadow: { borderRadius: 28, boxShadow: glassShadow },
    actionBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-around", overflow: "hidden",
      minHeight: 76, paddingHorizontal: 6, borderRadius: 28, backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.glassBorder
    },
    actionButton: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 6, borderRadius: 20 },
    actionButtonPressed: { transform: [{ scale: 0.92 }] },
    actionButtonDisabled: { opacity: 0.5 },
    actionIconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    actionLock: { position: "absolute", right: 2, bottom: 4, width: 13, height: 13, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: c.muted },
    actionLabel: { color: c.inkSoft, fontSize: 12, fontWeight: "600" },

    notice: {
      flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 28, borderRadius: 30,
      backgroundColor: c.glass, borderWidth: 1, borderColor: c.glassBorder
    },
    noticeIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    noticeTitle: { color: c.ink, fontSize: 20, fontWeight: "800", textAlign: "center" },
    noticeText: { color: c.inkSoft, fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 320 },
    noticeButton: { marginTop: 6, minHeight: 46, paddingHorizontal: 24, borderRadius: 23, alignItems: "center", justifyContent: "center" },
    noticeButtonText: { color: c.onPrimary, fontSize: 15, fontWeight: "800" },
    noticeSecondary: { minHeight: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
    noticeSecondaryText: { fontSize: 15, fontWeight: "800" },

    modeBadge: { alignSelf: "flex-start", maxWidth: 180, flexDirection: "row", alignItems: "center", gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1 },
    modeBadgeText: { flexShrink: 1, fontSize: 11, fontWeight: "800" },
    filterRow: { flexDirection: "row", gap: 8, paddingRight: 8 },
    filterChip: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: c.fill, borderWidth: 1, borderColor: c.fillStrong },
    filterChipText: { color: c.ink, fontSize: 13, fontWeight: "800" }
  });
}

const sheets = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };

export function useDiscoverPalette() {
  return useStyles().palette;
}

// ─── Chat context badge (Romantic / Friends / Event + event name) ───────
export function ModeBadge({ mode, eventTitle }: { mode?: DiscoverMode | null; eventTitle?: string | null }) {
  const { palette, styles } = useStyles();
  if (!mode) return null;
  const item = DISCOVER_MODES.find((entry) => entry.id === mode) ?? DISCOVER_MODES[0];
  const accent = modeAccent(palette, item.id);
  return (
    <View style={[styles.modeBadge, { borderColor: `${accent}66`, backgroundColor: `${accent}1f` }]}>
      <MaterialCommunityIcons name={item.icon as any} size={12} color={accent} />
      <Text style={[styles.modeBadgeText, { color: accent }]} numberOfLines={1}>{mode === "event" && eventTitle ? eventTitle : item.label}</Text>
    </View>
  );
}

/** Chats filter: Wszystkie / Romantic / Friends / Event. */
export function ModeFilter({ value, onChange, counts }: { value: DiscoverMode | "all"; onChange: (value: DiscoverMode | "all") => void; counts: Record<DiscoverMode | "all", number> }) {
  const { palette, styles } = useStyles();
  const items: { id: DiscoverMode | "all"; label: string; icon: string }[] = [{ id: "all", label: "Wszystkie", icon: "forum-outline" }, ...DISCOVER_MODES];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} accessibilityRole="tablist">
      {items.map((item) => {
        const active = value === item.id;
        const accent = item.id === "all" ? palette.primary : modeAccent(palette, item.id);
        return (
          <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(item.id)} style={[styles.filterChip, active && { backgroundColor: accent, borderColor: accent }]}>
            <MaterialCommunityIcons name={item.icon as any} size={14} color={active ? palette.onPrimary : accent} />
            <Text style={[styles.filterChipText, active && { color: palette.onPrimary }]}>{item.label} {counts[item.id] > 0 ? counts[item.id] : ""}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
