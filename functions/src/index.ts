import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

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