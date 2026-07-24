import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldPath, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();

const db = getFirestore();
const region = "europe-west1";

type NotificationCategory = "messages" | "matches" | "requests" | "events";

type NotificationPayload = {
  title: string;
  body: string;
  category: NotificationCategory;
  data: Record<string, string>;
};

type PushRegistration = {
  token: string;
  sound: boolean;
  ref: FirebaseFirestore.DocumentReference;
};

async function claimEvent(eventId: string) {
  const eventRef = db.collection("notificationEvents").doc(eventId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(eventRef);
    if (snapshot.exists) return false;
    transaction.create(eventRef, {
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    return true;
  });
}

function notificationPreference(data: FirebaseFirestore.DocumentData, category: NotificationCategory) {
  const preferences = data.notificationPreferences && typeof data.notificationPreferences === "object"
    ? data.notificationPreferences as Record<string, unknown>
    : {};
  if (preferences[category] === false) return { allowed: false, sound: false };

  const quietEnabled = preferences.quietHoursEnabled === true;
  const quietStart = typeof preferences.quietStart === "string" ? preferences.quietStart : "22:00";
  const quietEnd = typeof preferences.quietEnd === "string" ? preferences.quietEnd : "08:00";
  const timeZone = typeof preferences.timeZone === "string" ? preferences.timeZone : "Europe/Warsaw";
  let localMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    localMinutes = hour * 60 + minute;
  } catch {
    // Invalid client timezone falls back to UTC.
  }
  const parseTime = (value: string, fallback: number) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
  };
  const start = parseTime(quietStart, 22 * 60);
  const end = parseTime(quietEnd, 8 * 60);
  const quiet = quietEnabled && (start <= end
    ? localMinutes >= start && localMinutes < end
    : localMinutes >= start || localMinutes < end);

  return {
    allowed: !quiet,
    sound: preferences.sound !== false
  };
}

function pushRegistration(document: FirebaseFirestore.QueryDocumentSnapshot, category: NotificationCategory) {
  const data = document.data();
  const token = data.enabled === true ? stringValue(data.token) : "";
  const preference = notificationPreference(data, category);
  return token && preference.allowed
    ? { token, sound: preference.sound, ref: document.ref } satisfies PushRegistration
    : null;
}

async function getPushTokens(uid: string, category: NotificationCategory) {
  const snapshot = await db.collection("users").doc(uid).collection("devices").where("enabled", "==", true).get();
  const registrations = new Map<string, PushRegistration>();
  snapshot.docs.forEach((document) => {
    const registration = pushRegistration(document, category);
    if (registration && !registrations.has(registration.token)) registrations.set(registration.token, registration);
  });
  return Array.from(registrations.values());
}

async function sendPushToTokens(registrations: PushRegistration[], payload: NotificationPayload) {
  for (let offset = 0; offset < registrations.length; offset += 100) {
    const chunk = registrations.slice(offset, offset + 100);
    const messages = chunk.map(({ token: to, sound }) => ({
      to,
      sound: sound ? "default" : undefined,
      badge: 1,
      title: payload.title,
      body: payload.body,
      data: { ...payload.data, category: payload.category },
      priority: "high"
    }));
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages)
    });
    if (!response.ok) {
      throw new Error("Expo push request failed with status " + response.status);
    }
    const body = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
    const tickets = Array.isArray(body.data) ? body.data : [];
    const invalidRegistrations = chunk.filter((_, index) => tickets[index]?.details?.error === "DeviceNotRegistered");
    await Promise.all(invalidRegistrations.map(({ ref }) => ref.delete().catch(() => undefined)));
  }
}

async function sendPush(uid: string, payload: NotificationPayload) {
  await sendPushToTokens(await getPushTokens(uid, payload.category), payload);
}

async function getProfileName(uid: string) {
  const snapshot = await db.collection("publicProfiles").doc(uid).get();
  if (!snapshot.exists) return "Ktoś";
  const profile = snapshot.data() ?? {};
  if (profile.profileNameMode === "nickname" && typeof profile.nickname === "string" && profile.nickname.trim()) {
    return profile.nickname.trim();
  }
  return typeof profile.firstName === "string" && profile.firstName.trim() ? profile.firstName.trim() : "Ktoś";
}

const premiumEntitlementId = "Sparknew Pro";
const sparkOwnerEmail = "wychor234@gmail.com";
const maxPremiumRequestsPerDay = 10;
const maxMessagesPerMinute = 20;
const minMessageIntervalMs = 700;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function claimEntitlements(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function containsBlockedText(text: string) {
  return /(porn|porno|nudes?|onlyfans|escort|prostytucj|sekskamera|zgwalce|zabije cie|heil hitler)/i.test(text);
}

async function hasVerifiedPro(uid: string, token: Record<string, unknown>) {
  const authUser = await getAuth().getUser(uid);
  const isOwner = authUser.emailVerified && authUser.email?.toLowerCase() === sparkOwnerEmail;
  const currentClaims = claimEntitlements(authUser.customClaims?.activeEntitlements);
  const requestClaims = claimEntitlements(token.activeEntitlements);
  return isOwner || currentClaims.includes(premiumEntitlementId) || requestClaims.includes(premiumEntitlementId);
}

async function requireSparkOwner(request: { auth?: { uid: string } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie.");
  const authUser = await getAuth().getUser(uid);
  if (!authUser.emailVerified || authUser.email?.toLowerCase() !== sparkOwnerEmail) {
    throw new HttpsError("permission-denied", "Brak dostępu do moderacji.");
  }
  return uid;
}
function conversationId(leftUid: string, rightUid: string) {
  return [leftUid, rightUid].sort().join("_");
}


function validateTargetUid(uid: string, targetUid: string) {
  if (!targetUid || targetUid.length > 128 || targetUid.includes("/") || targetUid === uid) {
    throw new HttpsError("invalid-argument", "Nieprawidłowy profil odbiorcy.");
  }
}

function eventSelectionFromSnapshot(snapshot: FirebaseFirestore.DocumentSnapshot) {
  if (!snapshot.exists) return null;
  const data = snapshot.data() ?? {};
  const endsAt = stringValue(data.endsAt);
  const expiresAt = new Date(endsAt).getTime() + 60 * 60 * 1000;
  if (!endsAt || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  const event = {
    id: snapshot.id,
    category: stringValue(data.category),
    name: stringValue(data.name),
    city: stringValue(data.city),
    date: stringValue(data.date),
    kind: "specific",
    icon: stringValue(data.icon),
    startsAt: stringValue(data.startsAt),
    endsAt
  };
  if (!event.category || !event.name || !event.city || !event.date || !event.icon || !event.startsAt) return null;
  return event;
}

export const listModerationReports = onCall(
  { region, timeoutSeconds: 20 },
  async (request) => {
    await requireSparkOwner(request);
    const snapshot = await db.collection("reports").orderBy("createdAt", "desc").limit(100).get();
    return {
      reports: snapshot.docs.map((document) => {
        const data = document.data();
        return {
          id: document.id,
          reporterUid: stringValue(data.reporterUid),
          targetUid: stringValue(data.targetUid),
          reason: stringValue(data.reason),
          context: stringValue(data.context),
          status: stringValue(data.status) || "open",
          createdAtMs: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : 0
        };
      })
    };
  }
);

export const resolveModerationReport = onCall(
  { region, timeoutSeconds: 20 },
  async (request) => {
    const reviewerUid = await requireSparkOwner(request);
    const data = request.data && typeof request.data === "object" ? request.data as Record<string, unknown> : {};
    const reportId = stringValue(data.reportId);
    const action = stringValue(data.action);
    if (!reportId || reportId.includes("/") || !["dismiss", "warn", "suspend"].includes(action)) {
      throw new HttpsError("invalid-argument", "Nieprawidłowa akcja moderacji.");
    }

    const reportRef = db.collection("reports").doc(reportId);
    const report = await reportRef.get();
    if (!report.exists) throw new HttpsError("not-found", "Zgłoszenie nie istnieje.");
    const targetUid = stringValue(report.data()?.targetUid);
    const status = action === "dismiss" ? "dismissed" : action === "warn" ? "warned" : "suspended";
    const batch = db.batch();
    batch.update(reportRef, {
      status,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedByUid: reviewerUid,
      moderationAction: action
    });
    if (action === "suspend" && targetUid) {
      batch.set(db.collection("users").doc(targetUid), { moderationStatus: "suspended", verificationStatus: "none", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      batch.set(db.collection("publicProfiles").doc(targetUid), { moderationStatus: "suspended", isVerified: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
    if (action === "warn" && targetUid) {
      await sendPush(targetUid, {
        category: "requests",
        title: "Wiadomo\u015b\u0107 od zespo\u0142u Spark",
        body: "Otrzymali\u015bmy zg\u0142oszenie dotycz\u0105ce Twojego konta. Sprawd\u017a zasady spo\u0142eczno\u015bci.",
        data: { route: "matches" }
      }).catch((error) => console.error("Moderation warning push failed", error));
    }
    return { ok: true as const };
  }
);
export const syncProfileVerification = onCall(
  { region, timeoutSeconds: 20 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie.");
    const authUser = await getAuth().getUser(uid);
    const verified = authUser.providerData.some((provider) => provider.providerId === "google.com" || provider.providerId === "apple.com");
    const userRef = db.collection("users").doc(uid);
    const publicRef = db.collection("publicProfiles").doc(uid);
    await db.runTransaction(async (transaction) => {
      const [user, publicProfile] = await Promise.all([transaction.get(userRef), transaction.get(publicRef)]);
      if (!user.exists) throw new HttpsError("failed-precondition", "Najpierw utwórz profil Spark.");
      transaction.set(userRef, {
        verificationStatus: verified ? "verified" : "none",
        verificationReviewedAt: FieldValue.serverTimestamp(),
        verificationReviewedByUid: verified ? "provider:" + authUser.providerData.map((provider) => provider.providerId).filter((providerId) => providerId === "google.com" || providerId === "apple.com").join("+") : "system:no-trusted-provider"
      }, { merge: true });
      if (publicProfile.exists) {
        transaction.set(publicRef, { isVerified: verified, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    });
    return { status: verified ? "verified" as const : "none" as const };
  }
);

export const updateActiveEvents = onCall(
  { region, timeoutSeconds: 20 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie, aby zapisać wydarzenia.");
    const data = request.data && typeof request.data === "object" ? request.data as Record<string, unknown> : {};
    const eventIds = Array.isArray(data.eventIds)
      ? Array.from(new Set(data.eventIds.map(stringValue).filter((id) => id && id.length <= 220 && !id.includes("/")))).slice(0, 4)
      : [];
    if (!Array.isArray(data.eventIds) || data.eventIds.length > 4) {
      throw new HttpsError("invalid-argument", "Możesz wybrać maksymalnie 4 wydarzenia.");
    }

    const eventSnapshots = eventIds.length > 0
      ? await db.getAll(...eventIds.map((eventId) => db.collection("sparkEvents").doc(eventId)))
      : [];
    const events = eventSnapshots.map(eventSelectionFromSnapshot).filter((event): event is NonNullable<typeof event> => Boolean(event));
    const activeEventIds = events.map((event) => event.id);
    const userRef = db.collection("users").doc(uid);
    const publicProfileRef = db.collection("publicProfiles").doc(uid);

    await db.runTransaction(async (transaction) => {
      const user = await transaction.get(userRef);
      const publicProfile = await transaction.get(publicProfileRef);
      if (!user.exists || user.data()?.moderationStatus === "suspended") {
        throw new HttpsError("permission-denied", "To konto nie może teraz aktualizować wydarzeń.");
      }
      if (!publicProfile.exists) {
        throw new HttpsError("failed-precondition", "Najpierw dokończ profil, aby dołączyć do wydarzenia.");
      }
      const update = { activeEvents: events, activeEventIds };
      transaction.update(userRef, update);
      transaction.update(publicProfileRef, {
        activeEvents: events,
        activeEventIds,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return { events };
  }
);
export const resetPassedProfiles = onCall(
  { region, timeoutSeconds: 30 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie, aby przywrócić pominięte profile.");

    let removed = 0;
    for (let round = 0; round < 20; round += 1) {
      const passedSwipes = await db.collection("swipes")
        .where("fromUid", "==", uid)
        .where("status", "==", "passed")
        .limit(400)
        .get();
      if (passedSwipes.empty) break;

      const batch = db.batch();
      passedSwipes.docs.forEach((snapshot) => batch.delete(snapshot.ref));
      await batch.commit();
      removed += passedSwipes.size;
      if (passedSwipes.size < 400) break;
    }

    return { removed };
  }
);

export const cancelProfileLike = onCall(
  { region, timeoutSeconds: 15 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie, aby usunąć polubienie.");
    const data = request.data && typeof request.data === "object" ? request.data as Record<string, unknown> : {};
    const targetUid = stringValue(data.targetUid);
    validateTargetUid(uid, targetUid);
    const swipes = await db.collection("swipes").where("fromUid", "==", uid).where("toProfileKey", "==", targetUid).limit(20).get();
    if (swipes.empty) return { removed: 0 };
    const batch = db.batch();
    swipes.docs.forEach((snapshot) => batch.delete(snapshot.ref));
    await batch.commit();
    return { removed: swipes.size };
  }
);

export const sendSparkLike = onCall(
  { region, timeoutSeconds: 15 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie, aby wysłać SparkLike.");
    const data = request.data && typeof request.data === "object" ? request.data as Record<string, unknown> : {};
    const targetUid = stringValue(data.targetUid);
    const eventId = stringValue(data.eventId);
    validateTargetUid(uid, targetUid);
    if (!(await hasVerifiedPro(uid, request.auth?.token ?? {}))) {
      throw new HttpsError("permission-denied", "Spark Pro nie jest jeszcze aktywny po stronie serwera. Odśwież dostęp Pro i spróbuj ponownie za chwilę.");
    }

    const nowMs = Date.now();
    const now = new Date(nowMs);
    const currentPeriod = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;
    const canonicalSwipeRef = db.collection("swipes").doc(uid + "_" + targetUid);
    const accountRef = db.collection("users").doc(uid);
    const senderProfileRef = db.collection("publicProfiles").doc(uid);
    const targetProfileRef = db.collection("publicProfiles").doc(targetUid);
    const senderBlockRef = accountRef.collection("blocks").doc(targetUid);
    const targetBlockRef = db.collection("users").doc(targetUid).collection("blocks").doc(uid);
    const matchRef = db.collection("matches").doc(conversationId(uid, targetUid));
    const eventRef = eventId ? db.collection("sparkEvents").doc(eventId) : null;
    const legacySwipes = await db.collection("swipes").where("fromUid", "==", uid).where("toProfileKey", "==", targetUid).limit(20).get();

    return db.runTransaction(async (transaction) => {
      const account = await transaction.get(accountRef);
      const senderProfile = await transaction.get(senderProfileRef);
      const targetProfile = await transaction.get(targetProfileRef);
      const senderBlock = await transaction.get(senderBlockRef);
      const targetBlock = await transaction.get(targetBlockRef);
      const canonicalSwipe = await transaction.get(canonicalSwipeRef);
      const existingMatch = await transaction.get(matchRef);
      const event = eventRef ? await transaction.get(eventRef) : null;

      if (!account.exists || account.data()?.moderationStatus === "suspended") {
        throw new HttpsError("permission-denied", "To konto nie może teraz wysyłać SparkLike.");
      }
      if (!senderProfile.exists || !targetProfile.exists) {
        throw new HttpsError("not-found", "Ten profil nie jest już dostępny.");
      }
      const targetData = targetProfile.data() ?? {};
      const targetIsTestProfile = targetData.isTestProfile === true;
      if (senderBlock.exists || (targetBlock.exists && !targetIsTestProfile)) {
        throw new HttpsError("permission-denied", "Nie możesz wysłać SparkLike do tego profilu.");
      }

      const accountData = account.data() ?? {};
      const used = accountData.superlikePeriod === currentPeriod && typeof accountData.superlikesUsed === "number" ? accountData.superlikesUsed : 0;
      const alreadySuperliked = canonicalSwipe.exists && canonicalSwipe.data()?.direction === "superlike";
      if (!alreadySuperliked && used >= 10) {
        throw new HttpsError("resource-exhausted", "Miesięczny limit 10 SparkLike został wykorzystany.");
      }


      const resetAt = targetData.isTestProfile === true ? Timestamp.fromMillis(nowMs + 24 * 60 * 60 * 1000) : null;
      const previousSwipe = legacySwipes.docs.find((snapshot) => snapshot.data().eventContext)?.data() ?? {};
      const senderData = senderProfile.data() ?? {};
      const senderEvents = Array.isArray(senderData.activeEventIds) ? senderData.activeEventIds : [];
      const targetEvents = Array.isArray(targetData.activeEventIds) ? targetData.activeEventIds : [];
      const eventData = event?.exists ? event.data() ?? {} : {};
      const hasSharedEvent = Boolean(eventId && event?.exists && senderEvents.includes(eventId) && (targetEvents.includes(eventId) || targetIsTestProfile));
      const eventContext = hasSharedEvent ? {
        id: eventId,
        category: eventData.category,
        name: eventData.name,
        city: eventData.city,
        date: eventData.date,
        kind: "specific",
        icon: eventData.icon,
        startsAt: eventData.startsAt,
        endsAt: eventData.endsAt
      } : previousSwipe.eventContext ?? null;
      const matchData = existingMatch.data() ?? {};
      if (existingMatch.exists && ["blocked", "rejected"].includes(String(matchData.status))) {
        throw new HttpsError("failed-precondition", "Ta relacja została wcześniej zamknięta.");
      }

      transaction.set(canonicalSwipeRef, {
        fromUid: uid,
        toProfileKey: targetUid,
        direction: "superlike",
        status: "liked",
        matchScore: typeof data.matchScore === "number" ? Math.max(0, Math.min(100, data.matchScore)) : null,
        eventContext,
        resetAt,
        createdAt: canonicalSwipe.exists ? canonicalSwipe.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      if (!alreadySuperliked) {
        transaction.update(accountRef, {
          superlikePeriod: currentPeriod,
          superlikesUsed: used + 1,
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      if (existingMatch.exists) {
        transaction.update(matchRef, {
          status: "matched",
          source: "superlike",
          eventContext: matchData.eventContext ?? eventContext,
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        transaction.create(matchRef, {
          memberUids: [uid, targetUid],
          createdByUid: uid,
          source: "superlike",
          eventContext,
          status: "matched",
          resetAt,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      legacySwipes.docs.filter((snapshot) => snapshot.ref.path !== canonicalSwipeRef.path).forEach((snapshot) => transaction.delete(snapshot.ref));
      return {
        status: "matched" as const,
        threadId: matchRef.id,
        superlikesRemaining: Math.max(0, 10 - used - (alreadySuperliked ? 0 : 1))
      };
    });
  }
);

export const createPremiumChatRequest = onCall(
  { region, timeoutSeconds: 15 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie, aby wysłać prośbę.");

    const data = request.data && typeof request.data === "object" ? request.data as Record<string, unknown> : {};
    const targetUid = stringValue(data.targetUid);
    const introMessage = stringValue(data.introMessage);
    const eventId = stringValue(data.eventId);

    if (!targetUid || targetUid.length > 128 || targetUid.includes("/") || targetUid === uid) {
      throw new HttpsError("invalid-argument", "Nieprawidłowy profil odbiorcy.");
    }
    if (!introMessage || introMessage.length > 500 || containsBlockedText(introMessage)) {
      throw new HttpsError("invalid-argument", "Wiadomość otwierająca musi mieć od 1 do 500 znaków i przestrzegać zasad Spark.");
    }
    if (!(await hasVerifiedPro(uid, request.auth?.token ?? {}))) {
      throw new HttpsError("permission-denied", "Spark Pro nie jest jeszcze aktywny po stronie serwera. Odśwież dostęp Pro i spróbuj ponownie za chwilę.");
    }

    const nowMs = Date.now();
    const dayKey = new Date(nowMs).toISOString().slice(0, 10);
    const threadId = conversationId(uid, targetUid);
    const senderUserRef = db.collection("users").doc(uid);
    const senderProfileRef = db.collection("publicProfiles").doc(uid);
    const targetProfileRef = db.collection("publicProfiles").doc(targetUid);
    const senderBlockRef = senderUserRef.collection("blocks").doc(targetUid);
    const targetBlockRef = db.collection("users").doc(targetUid).collection("blocks").doc(uid);
    const matchRef = db.collection("matches").doc(threadId);
    const usageRef = senderUserRef.collection("usage").doc("premiumChatRequests");
    const eventRef = eventId ? db.collection("sparkEvents").doc(eventId) : null;

    return db.runTransaction(async (transaction) => {
      const senderUser = await transaction.get(senderUserRef);
      const senderProfile = await transaction.get(senderProfileRef);
      const targetProfile = await transaction.get(targetProfileRef);
      const senderBlock = await transaction.get(senderBlockRef);
      const targetBlock = await transaction.get(targetBlockRef);
      const existingMatch = await transaction.get(matchRef);
      const usage = await transaction.get(usageRef);
      const event = eventRef ? await transaction.get(eventRef) : null;

      if (!senderUser.exists || senderUser.data()?.moderationStatus === "suspended") {
        throw new HttpsError("permission-denied", "To konto nie może teraz wysyłać próśb.");
      }
      if (!senderProfile.exists || !targetProfile.exists) {
        throw new HttpsError("not-found", "Ten profil nie jest już dostępny.");
      }
      const targetProfileData = targetProfile.data() ?? {};
      const targetIsTestProfile = targetProfileData.isTestProfile === true;
      if (senderBlock.exists || (targetBlock.exists && !targetIsTestProfile)) {
        throw new HttpsError("permission-denied", "Nie możesz wysłać prośby do tego profilu.");
      }
      if (existingMatch.exists) {
        const status = existingMatch.data()?.status;
        if (status === "matched" || status === "requested") {
          return { status, threadId, remainingToday: Math.max(0, maxPremiumRequestsPerDay - Number(usage.data()?.requestCount ?? 0)) };
        }
        throw new HttpsError("failed-precondition", "Ta rozmowa została wcześniej zamknięta.");
      }

      const previousCount = usage.data()?.dayKey === dayKey ? Number(usage.data()?.requestCount ?? 0) : 0;
      if (!Number.isFinite(previousCount) || previousCount >= maxPremiumRequestsPerDay) {
        throw new HttpsError("resource-exhausted", "Dzisiejszy limit 10 próśb o chat został wykorzystany.");
      }

      const senderProfileData = senderProfile.data() ?? {};
      const senderEventIds = Array.isArray(senderProfileData.activeEventIds) ? senderProfileData.activeEventIds : [];
      const targetEventIds = Array.isArray(targetProfileData.activeEventIds) ? targetProfileData.activeEventIds : [];
      const eventData = event?.exists ? event.data() ?? {} : {};
      const hasSharedEvent = Boolean(eventId && event?.exists && senderEventIds.includes(eventId) && (targetEventIds.includes(eventId) || targetIsTestProfile));
      const eventContext = hasSharedEvent ? {
        id: eventId,
        category: eventData.category,
        name: eventData.name,
        city: eventData.city,
        date: eventData.date,
        kind: "specific",
        icon: eventData.icon,
        startsAt: eventData.startsAt,
        endsAt: eventData.endsAt
      } : null;

      transaction.create(matchRef, {
        memberUids: [uid, targetUid],
        createdByUid: uid,
        source: "premium-request",
        introMessage,
        eventContext,
        status: "requested",
        resetAt: targetProfileData.isTestProfile === true ? Timestamp.fromMillis(nowMs + 24 * 60 * 60 * 1000) : null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.set(usageRef, {
        dayKey,
        requestCount: previousCount + 1,
        updatedAt: FieldValue.serverTimestamp()
      });

      return {
        status: "requested" as const,
        threadId,
        remainingToday: maxPremiumRequestsPerDay - previousCount - 1
      };
    });
  }
);

export const sendChatMessage = onCall(
  { region, timeoutSeconds: 15 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie, aby wysłać wiadomość.");

    const data = request.data && typeof request.data === "object" ? request.data as Record<string, unknown> : {};
    const threadId = stringValue(data.threadId);
    const text = stringValue(data.text);
    if (!threadId || threadId.length > 260 || threadId.includes("/")) {
      throw new HttpsError("invalid-argument", "Nieprawidłowy identyfikator rozmowy.");
    }
    if (!text || text.length > 2000 || containsBlockedText(text)) {
      throw new HttpsError("invalid-argument", "Wiadomość musi mieć od 1 do 2000 znaków i przestrzegać zasad Spark.");
    }

    const nowMs = Date.now();
    const minuteKey = Math.floor(nowMs / 60_000);
    const matchRef = db.collection("matches").doc(threadId);
    const usageRef = db.collection("users").doc(uid).collection("usage").doc("chatMessages");
    const messageRef = db.collection("messages").doc(threadId).collection("items").doc();

    return db.runTransaction(async (transaction) => {
      const match = await transaction.get(matchRef);
      const usage = await transaction.get(usageRef);
      const matchData = match.data();

      if (!match.exists || matchData?.status !== "matched" || !Array.isArray(matchData.memberUids) || !matchData.memberUids.includes(uid)) {
        throw new HttpsError("permission-denied", "Wiadomości są dostępne dopiero po aktywnym matchu.");
      }

      const previousCount = usage.data()?.minuteKey === minuteKey ? Number(usage.data()?.messageCount ?? 0) : 0;
      const lastSentAtMs = Number(usage.data()?.lastSentAtMs ?? 0);
      if (lastSentAtMs > 0 && nowMs - lastSentAtMs < minMessageIntervalMs) {
        throw new HttpsError("resource-exhausted", "Odczekaj chwilę przed wysłaniem kolejnej wiadomości.");
      }
      if (!Number.isFinite(previousCount) || previousCount >= maxMessagesPerMinute) {
        throw new HttpsError("resource-exhausted", "Limit 20 wiadomości na minutę został wykorzystany.");
      }

      const recipientUid = matchData.memberUids.find((memberUid: unknown) => typeof memberUid === "string" && memberUid !== uid);
      if (typeof recipientUid !== "string") {
        throw new HttpsError("failed-precondition", "Rozmowa nie ma prawidłowego odbiorcy.");
      }
      const currentUnread = matchData.unreadCountByUid && typeof matchData.unreadCountByUid === "object"
        ? Number((matchData.unreadCountByUid as Record<string, unknown>)[recipientUid] ?? 0)
        : 0;
      const messageTimestamp = Timestamp.fromMillis(nowMs);

      transaction.create(messageRef, {
        senderUid: uid,
        text,
        createdAt: messageTimestamp
      });
      transaction.update(matchRef, {
        unreadCountByUid: {
          ...(matchData.unreadCountByUid && typeof matchData.unreadCountByUid === "object" ? matchData.unreadCountByUid : {}),
          [uid]: 0,
          [recipientUid]: Math.min(999, Math.max(0, Number.isFinite(currentUnread) ? currentUnread : 0) + 1)
        },
        readAtByUid: {
          ...(matchData.readAtByUid && typeof matchData.readAtByUid === "object" ? matchData.readAtByUid : {}),
          [uid]: messageTimestamp
        },
        lastMessageAt: messageTimestamp,
        lastMessageSenderUid: uid,
        lastMessageText: text.slice(0, 240),
        updatedAt: messageTimestamp
      });
      transaction.set(usageRef, {
        minuteKey,
        messageCount: previousCount + 1,
        lastSentAtMs: nowMs,
        updatedAt: FieldValue.serverTimestamp()
      });

      return { messageId: messageRef.id };
    });
  }
);

export const markChatThreadRead = onCall(
  { region, timeoutSeconds: 15 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie, aby otworzyć rozmowę.");
    const data = request.data && typeof request.data === "object" ? request.data as Record<string, unknown> : {};
    const threadId = stringValue(data.threadId);
    if (!threadId || threadId.length > 260 || threadId.includes("/")) {
      throw new HttpsError("invalid-argument", "Nieprawidłowy identyfikator rozmowy.");
    }

    const matchRef = db.collection("matches").doc(threadId);
    await db.runTransaction(async (transaction) => {
      const match = await transaction.get(matchRef);
      const matchData = match.data();
      if (!match.exists || !Array.isArray(matchData?.memberUids) || !matchData.memberUids.includes(uid)) {
        throw new HttpsError("permission-denied", "Nie masz dostępu do tej rozmowy.");
      }
      transaction.update(matchRef, {
        unreadCountByUid: {
          ...(matchData?.unreadCountByUid && typeof matchData.unreadCountByUid === "object" ? matchData.unreadCountByUid : {}),
          [uid]: 0
        },
        readAtByUid: {
          ...(matchData?.readAtByUid && typeof matchData.readAtByUid === "object" ? matchData.readAtByUid : {}),
          [uid]: FieldValue.serverTimestamp()
        },
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    return { ok: true as const };
  }
);

async function deleteQueryDocuments(query: FirebaseFirestore.Query) {
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    if (snapshot.size < 400) return;
  }
}

async function deleteDocumentReferences(references: FirebaseFirestore.DocumentReference[]) {
  for (let offset = 0; offset < references.length; offset += 400) {
    const batch = db.batch();
    references.slice(offset, offset + 400).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

export const deleteMatchThread = onCall(
  { region },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie.");

    const threadId = stringValue(request.data?.threadId);
    const mode = stringValue(request.data?.mode);
    if (!threadId || threadId.length > 256 || threadId.includes("/") || !["cancel", "expired"].includes(mode)) {
      throw new HttpsError("invalid-argument", "Nieprawidłowa relacja.");
    }

    const matchRef = db.collection("matches").doc(threadId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(matchRef);
      if (!snapshot.exists) return;
      const data = snapshot.data() ?? {};
      const members = Array.isArray(data.memberUids) ? data.memberUids.map(String) : [];
      if (!members.includes(uid)) throw new HttpsError("permission-denied", "Nie możesz usunąć tej relacji.");

      const resetAt = data.resetAt instanceof Timestamp ? data.resetAt.toMillis() : null;
      const canCancel = mode === "cancel" && data.status === "requested" && data.createdByUid === uid;
      const canClearExpired = mode === "expired" && resetAt !== null && resetAt <= Date.now();
      if (!canCancel && !canClearExpired) {
        throw new HttpsError("failed-precondition", "Tej relacji nie można teraz usunąć.");
      }

      transaction.update(matchRef, { status: "deleting", updatedAt: FieldValue.serverTimestamp() });
    });

    const snapshot = await matchRef.get();
    if (!snapshot.exists) return { deleted: false as const };
    const data = snapshot.data() ?? {};
    if (data.status !== "deleting" || !Array.isArray(data.memberUids) || !data.memberUids.map(String).includes(uid)) {
      throw new HttpsError("aborted", "Stan relacji zmienił się. Spróbuj ponownie.");
    }

    await db.recursiveDelete(db.collection("messages").doc(threadId));
    await matchRef.delete();
    return { deleted: true as const };
  }
);

export const deleteSparkAccount = onCall(  { region, timeoutSeconds: 540, memory: "512MiB" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Zaloguj się ponownie, aby usunąć konto.");

    const deletionRef = db.collection("accountDeletions").doc(uid);
    await deletionRef.set({
      uid,
      reason: "in-app-delete-account",
      status: "processing",
      requestedAt: FieldValue.serverTimestamp()
    });

    const matches = await db.collection("matches").where("memberUids", "array-contains", uid).get();

    for (const match of matches.docs) {
      await db.recursiveDelete(db.collection("messages").doc(match.id));
    }

    await Promise.all([
      deleteQueryDocuments(db.collection("swipes").where("fromUid", "==", uid)),
      deleteQueryDocuments(db.collection("swipes").where("toProfileKey", "==", uid)),
      deleteQueryDocuments(db.collectionGroup("blocks").where("blockedUid", "==", uid)),
      deleteQueryDocuments(db.collectionGroup("profileViews").where("viewerUid", "==", uid))
    ]);
    await deleteDocumentReferences(matches.docs.map((document) => document.ref));

    await Promise.all([
      db.recursiveDelete(db.collection("users").doc(uid)),
      db.recursiveDelete(db.collection("privateProfiles").doc(uid)),
      db.recursiveDelete(db.collection("publicProfiles").doc(uid)),
      db.recursiveDelete(db.collection("revenuecat_customers").doc(uid)),
      deleteQueryDocuments(db.collection("revenuecat_events").where("app_user_id", "==", uid)),
      getStorage().bucket().deleteFiles({ prefix: "users/" + uid + "/" }).catch((error: unknown) => {
        const code = typeof error === "object" && error !== null && "code" in error ? Number(error.code) : 0;
        if (code !== 404) throw error;
      })
    ]);

    await getAuth().deleteUser(uid);
    await deletionRef.delete().catch(() => undefined);
    return { deleted: true as const };
  }
);

export const notifyNewMatch = onDocumentCreated(
  { document: "matches/{matchId}", region },
  async (event) => {
    if (!event.data || !(await claimEvent(event.id))) return;
    const match = event.data.data();
    const members = Array.isArray(match.memberUids) ? match.memberUids.filter((uid): uid is string => typeof uid === "string") : [];
    const recipientUid = members.find((uid) => uid !== match.createdByUid);
    if (!recipientUid) return;

    const senderName = await getProfileName(String(match.createdByUid ?? ""));
    const requested = match.status === "requested";
    await sendPush(recipientUid, {
      category: requested ? "requests" : "matches",
      title: requested ? "Nowa prośba o rozmowę" : "Nowy match w Spark",
      body: requested ? senderName + " chce rozpocząć rozmowę." : "Ty i " + senderName + " polubiliście się nawzajem.",
      data: { route: requested ? "messages" : "matches", threadId: event.params.matchId }
    });
  }
);

export const notifyAcceptedRequest = onDocumentUpdated(
  { document: "matches/{matchId}", region },
  async (event) => {
    if (!event.data || event.data.before.data().status !== "requested" || event.data.after.data().status !== "matched") return;
    if (!(await claimEvent(event.id))) return;
    const match = event.data.after.data();
    const recipientUid = typeof match.createdByUid === "string" ? match.createdByUid : null;
    const acceptedByUid = typeof match.acceptedByUid === "string" ? match.acceptedByUid : null;
    if (!recipientUid || !acceptedByUid || recipientUid === acceptedByUid) return;
    const name = await getProfileName(acceptedByUid);
    await sendPush(recipientUid, {
      category: "requests",
      title: "Prośba zaakceptowana",
      body: name + " zaakceptował(a) Twoją prośbę. Możecie już pisać.",
      data: { route: "messages", threadId: event.params.matchId }
    });
  }
);

export const notifyNewMessage = onDocumentCreated(
  { document: "messages/{threadId}/items/{messageId}", region },
  async (event) => {
    if (!event.data || !(await claimEvent(event.id))) return;
    const message = event.data.data();
    const senderUid = typeof message.senderUid === "string" ? message.senderUid : null;
    if (!senderUid) return;

    const matchSnapshot = await db.collection("matches").doc(event.params.threadId).get();
    const match = matchSnapshot.data();
    if (!matchSnapshot.exists || match?.status !== "matched") return;
    const members = Array.isArray(match.memberUids) ? match.memberUids.filter((uid): uid is string => typeof uid === "string") : [];
    const recipientUid = members.find((uid) => uid !== senderUid);
    if (!recipientUid) return;

    const senderName = await getProfileName(senderUid);
    const text = typeof message.text === "string" ? message.text.trim().slice(0, 120) : "Nowa wiadomość";
    await sendPush(recipientUid, {
      category: "messages",
      title: senderName,
      body: text,
      data: { route: "messages", threadId: event.params.threadId, senderUid }
    });
  }
);

async function removeEventFromProfiles(collectionName: "users" | "publicProfiles", eventId: string) {
  while (true) {
    const snapshot = await db.collection(collectionName)
      .where("activeEventIds", "array-contains", eventId)
      .limit(400)
      .get();
    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach((document) => {
      const data = document.data();
      const activeEvents = Array.isArray(data.activeEvents)
        ? data.activeEvents.filter((item) => item && typeof item === "object" && item.id !== eventId)
        : [];
      const activeEventIds = Array.isArray(data.activeEventIds)
        ? data.activeEventIds.filter((id): id is string => typeof id === "string" && id !== eventId)
        : [];
      batch.update(document.ref, {
        activeEvents,
        activeEventIds,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
  }
}

export const notifyNewSparkEvent = onDocumentCreated(
  { document: "sparkEvents/{eventId}", region, timeoutSeconds: 540 },
  async (event) => {
    if (!event.data || !(await claimEvent(event.id))) return;
    const eventData = event.data.data();
    const eventName = stringValue(eventData.name) || "nowe wydarzenie";
    const seenTokens = new Set<string>();
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    try {
      while (true) {
        let devicesQuery = db.collectionGroup("devices")
          .orderBy(FieldPath.documentId())
          .limit(500);
        if (cursor) devicesQuery = devicesQuery.startAfter(cursor);
        const devices = await devicesQuery.get();
        if (devices.empty) break;

        const registrations: PushRegistration[] = [];
        devices.docs.forEach((document) => {
          const registration = pushRegistration(document, "events");
          if (registration && !seenTokens.has(registration.token)) {
            seenTokens.add(registration.token);
            registrations.push(registration);
          }
        });
        await sendPushToTokens(registrations, {
          category: "events",
          title: "Nowe wydarzenie w aplikacji Spark!",
          body: "Teraz mo\u017cecie razem i\u015b\u0107 na popularne eventy. Kliknij, aby zobaczy\u0107: " + eventName + ".",
          data: { route: "eventFriends", eventId: event.params.eventId }
        });

        cursor = devices.docs[devices.docs.length - 1] ?? null;
        if (devices.size < 500) break;
      }
    } catch (error) {
      await db.collection("notificationEvents").doc(event.id).delete().catch(() => undefined);
      throw error;
    }
  }
);
export const cleanupDeletedSparkEvent = onDocumentDeleted(
  { document: "sparkEvents/{eventId}", region },
  async (event) => {
    await Promise.all([
      removeEventFromProfiles("users", event.params.eventId),
      removeEventFromProfiles("publicProfiles", event.params.eventId)
    ]);
  }
);

export const cleanupExpiredSparkEvents = onSchedule(
  { schedule: "every 15 minutes", timeZone: "Europe/Warsaw", region },
  async () => {
    const expiredSnapshot = await db.collection("sparkEvents")
      .where("deleteAt", "<=", Timestamp.now())
      .limit(100)
      .get();

    for (const eventDocument of expiredSnapshot.docs) {
      await Promise.all([
        removeEventFromProfiles("users", eventDocument.id),
        removeEventFromProfiles("publicProfiles", eventDocument.id)
      ]);
      await eventDocument.ref.delete();
    }
  }
);
