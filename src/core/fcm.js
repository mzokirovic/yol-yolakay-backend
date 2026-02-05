const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

function initFcm() {
  if (getApps().length) return;

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!b64 && !raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64 or FIREBASE_SERVICE_ACCOUNT_JSON");
  }

  const serviceAccount = b64
    ? JSON.parse(Buffer.from(b64, "base64").toString("utf8"))
    : JSON.parse(raw);

  initializeApp({ credential: cert(serviceAccount) });
}

async function sendToToken(token, payload) {
  initFcm();

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
