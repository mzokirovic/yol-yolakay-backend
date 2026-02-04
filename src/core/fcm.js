const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

function initFcm() {
  if (getApps().length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");

  const serviceAccount = JSON.parse(raw);

  initializeApp({
    credential: cert(serviceAccount),
  });
}

async function sendToToken(token, payload) {
  initFcm();

  // Firebase doc'ga ko'ra token + data/notification bilan yuboramiz :contentReference[oaicite:10]{index=10}
  return getMessaging().send({
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      notification_id: payload.notification_id ?? "",
      trip_id: payload.trip_id ?? "",
      thread_id: payload.thread_id ?? "",
      title: payload.title ?? "",
      body: payload.body ?? "",
    },
  });
}

module.exports = { sendToToken };
