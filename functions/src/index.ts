import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();

const db = getFirestore();
const region = "europe-west1";

type NotificationPayload = {
  title: string;
  body: string;
  data: Record<string, string>;
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

async function getPushTokens(uid: string) {
  const snapshot = await db.collection("users").doc(uid).collection("devices").where("enabled", "==", true).get();
  return Array.from(new Set(snapshot.docs.map((document) => String(document.data().token ?? "")).filter(Boolean)));
}

async function sendPush(uid: string, payload: NotificationPayload) {
  const tokens = await getPushTokens(uid);
  for (let offset = 0; offset < tokens.length; offset += 100) {
    const messages = tokens.slice(offset, offset + 100).map((to) => ({
      to,
      sound: "default",
      badge: 1,
      title: payload.title,
      body: payload.body,
      data: payload.data,
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
  }
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

function conversationId(leftUid: string, rightUid: string) {
  return [leftUid, rightUid].sort().join("_");
}

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
      if (senderBlock.exists || targetBlock.exists) {
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
      const targetProfileData = targetProfile.data() ?? {};
      const senderEventIds = Array.isArray(senderProfileData.activeEventIds) ? senderProfileData.activeEventIds : [];
      const targetEventIds = Array.isArray(targetProfileData.activeEventIds) ? targetProfileData.activeEventIds : [];
      const eventData = event?.exists ? event.data() ?? {} : {};
      const hasSharedEvent = Boolean(eventId && event?.exists && senderEventIds.includes(eventId) && targetEventIds.includes(eventId));
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
