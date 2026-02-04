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

  // ✅ DATA-ONLY: background/closed holatda ham Android Service ishlaydi
  return getMessaging().send({
    token,
    android: { priority: "high" },
    data: {
      notification_id: String(payload.notification_id ?? ""),
      trip_id: String(payload.trip_id ?? ""),
      thread_id: String(payload.thread_id ?? ""),
      title: String(payload.title ?? ""),
      body: String(payload.body ?? ""),
    },
  });
}

module.exports = { sendToToken };
