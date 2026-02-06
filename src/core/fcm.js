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
    // ✅ SENIOR FIX: "ttl: 0" - bu xabarni ushlab turmasdan darhol yetkazishni ta'minlaydi
    android: {
      priority: "high",
      ttl: 0,
    },
    // iOS uchun ham (kelajakda kerak bo'ladi)
    apns: {
      payload: {
        aps: {
          contentAvailable: true,
        },
      },
      headers: {
        "apns-priority": "10", // 10 = Immediate delivery
      },
    },
    data: {
      notification_id: String(payload.notification_id ?? ""),
      trip_id: String(payload.trip_id ?? ""),
      thread_id: String(payload.thread_id ?? ""),
      title: String(payload.title ?? ""),
      body: String(payload.body ?? ""),
      type: String(payload.type ?? "GENERAL") // Type qo'shish foydali
    },
  });
}

module.exports = { sendToToken };