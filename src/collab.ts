// Collab mode: people looking for others to work on a project with.
// Skills are stored as stable ids ("music.producer"); labels are Polish source
// texts translated at display time like the rest of the app.

export type CollabSubcategory = { id: string; label: string };
export type CollabCategory = { id: string; label: string; icon: string; items: CollabSubcategory[] };

export const collabCategories: readonly CollabCategory[] = [
  {
    id: "music", label: "Muzyka", icon: "music-note", items: [
      { id: "music.producer", label: "Producent muzyczny" },
      { id: "music.beatmaker", label: "Beatmaker" },
      { id: "music.rapper", label: "Raper" },
      { id: "music.vocals", label: "Wokal / śpiew" },
      { id: "music.lyrics", label: "Autor tekstów" },
      { id: "music.mixing", label: "Mix i mastering" },
      { id: "music.dj", label: "DJ" },
      { id: "music.instrument", label: "Instrumentalista" },
      { id: "music.composer", label: "Kompozytor" }
    ]
  },
  {
    id: "design", label: "Grafika i design", icon: "palette-outline", items: [
      { id: "design.graphic", label: "Grafik" },
      { id: "design.illustration", label: "Ilustrator" },
      { id: "design.uiux", label: "UI/UX" },
      { id: "design.branding", label: "Branding / logo" },
      { id: "design.motion", label: "Motion design" },
      { id: "design.3d", label: "Grafika 3D" },
      { id: "design.tattoo", label: "Tatuaż" }
    ]
  },
  {
    id: "video", label: "Foto i wideo", icon: "camera-outline", items: [
      { id: "video.photographer", label: "Fotograf" },
      { id: "video.camera", label: "Operator kamery" },
      { id: "video.editor", label: "Montażysta" },
      { id: "video.colorist", label: "Kolorysta" },
      { id: "video.director", label: "Reżyser teledysków" },
      { id: "video.drone", label: "Operator drona" }
    ]
  },
  {
    id: "tech", label: "Programowanie i tech", icon: "code-tags", items: [
      { id: "tech.frontend", label: "Frontend" },
      { id: "tech.backend", label: "Backend" },
      { id: "tech.mobile", label: "Aplikacje mobilne" },
      { id: "tech.gamedev", label: "Gamedev" },
      { id: "tech.ai", label: "AI / ML" },
      { id: "tech.nocode", label: "No-code" }
    ]
  },
  {
    id: "social", label: "Social media i marketing", icon: "cellphone-play", items: [
      { id: "social.creator", label: "Influencer / twórca" },
      { id: "social.shortvideo", label: "TikTok / Reels" },
      { id: "social.manager", label: "Social media manager" },
      { id: "social.copywriter", label: "Copywriter" },
      { id: "social.growth", label: "Marketing / growth" }
    ]
  },
  {
    id: "fashion", label: "Moda i uroda", icon: "hanger", items: [
      { id: "fashion.model", label: "Model / modelka" },
      { id: "fashion.stylist", label: "Stylista / stylistka" },
      { id: "fashion.makeup", label: "Makijaż" },
      { id: "fashion.designer", label: "Projektant/ka mody" }
    ]
  },
  {
    id: "business", label: "Biznes i startupy", icon: "rocket-launch-outline", items: [
      { id: "business.founder", label: "Founder / co-founder" },
      { id: "business.sales", label: "Sprzedaż" },
      { id: "business.product", label: "Product manager" },
      { id: "business.finance", label: "Finanse" }
    ]
  },
  {
    id: "media", label: "Treści i media", icon: "microphone-outline", items: [
      { id: "media.screenwriter", label: "Scenarzysta" },
      { id: "media.podcaster", label: "Podcaster" },
      { id: "media.journalist", label: "Dziennikarz" },
      { id: "media.translator", label: "Tłumacz" }
    ]
  },
  {
    id: "stage", label: "Scena i sztuka", icon: "drama-masks", items: [
      { id: "stage.actor", label: "Aktor / aktorka" },
      { id: "stage.dancer", label: "Tancerz / tancerka" },
      { id: "stage.artist", label: "Artysta wizualny" },
      { id: "stage.comedian", label: "Komik" }
    ]
  },
  {
    id: "gaming", label: "Gaming i e-sport", icon: "controller-classic-outline", items: [
      { id: "gaming.streamer", label: "Streamer" },
      { id: "gaming.player", label: "Gracz do składu" },
      { id: "gaming.creator", label: "Twórca gier" }
    ]
  }
];

export const collabMaxSkills = 5;
export const collabMaxLooking = 5;
export const collabPitchMaxLength = 150;
export const collabPortfolioMaxLength = 300;

const subcategories = new Map(collabCategories.flatMap((category) => category.items.map((item) => [item.id, { ...item, category }] as const)));

export function collabLabel(id: string): string {
  return subcategories.get(id)?.label ?? id;
}

export function collabCategoryOf(id: string): CollabCategory | null {
  return subcategories.get(id)?.category ?? null;
}

/** Known ids only, unique, in catalog order, capped. */
export function normalizeCollabIds(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(value.filter((item): item is string => typeof item === "string" && subcategories.has(item)));
  return Array.from(subcategories.keys()).filter((id) => wanted.has(id)).slice(0, max);
}

export function normalizeCollabPitch(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, collabPitchMaxLength) : "";
}

/** https links only, so a tap never opens anything unexpected. */
export function normalizeCollabPortfolio(value: unknown): string {
  if (typeof value !== "string") return "";
  let text = value.trim();
  if (!text) return "";
  if (!/^https?:\/\//i.test(text)) text = "https://" + text;
  text = text.replace(/^http:\/\//i, "https://");
  if (text.length > collabPortfolioMaxLength || /\s/.test(text) || !/^https:\/\/[^/]+\.[^/]+/i.test(text)) return "";
  return text;
}

export type CollabProfile = { skills: string[]; looking: string[]; pitch: string; remote: boolean; portfolio: string };

export function normalizeCollabProfile(source: Record<string, unknown> | null | undefined): CollabProfile {
  return {
    skills: normalizeCollabIds(source?.collabSkills, collabMaxSkills),
    looking: normalizeCollabIds(source?.collabLooking, collabMaxLooking),
    pitch: normalizeCollabPitch(source?.collabPitch),
    remote: source?.collabRemote === true,
    portfolio: normalizeCollabPortfolio(source?.collabPortfolio)
  };
}

/** Someone shows up in Collab once they say what they do and whom they look for. */
export function isCollabReady(profile: Pick<CollabProfile, "skills" | "looking">): boolean {
  return profile.skills.length > 0 && profile.looking.length > 0;
}

export type CollabFit = { theyHaveWhatIWant: string[]; iHaveWhatTheyWant: string[]; mutual: boolean; score: number };

export function collabFit(viewer: Pick<CollabProfile, "skills" | "looking">, other: Pick<CollabProfile, "skills" | "looking">): CollabFit {
  const theyHaveWhatIWant = other.skills.filter((id) => viewer.looking.includes(id));
  const iHaveWhatTheyWant = viewer.skills.filter((id) => other.looking.includes(id));
  const mutual = theyHaveWhatIWant.length > 0 && iHaveWhatTheyWant.length > 0;
  // Exact skill hits first, mutual need on top, same category as a weak signal.
  const sameCategory = other.skills.some((id) => viewer.looking.some((want) => collabCategoryOf(want)?.id === collabCategoryOf(id)?.id));
  const score = theyHaveWhatIWant.length * 30 + iHaveWhatTheyWant.length * 20 + (mutual ? 100 : 0) + (sameCategory ? 5 : 0);
  return { theyHaveWhatIWant, iHaveWhatTheyWant, mutual, score };
}
