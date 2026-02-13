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

// FCM data faqat string bo‘lishi kerak
function toDataString(v) {
  if (v === null || v === undefined) return null;
  const t = typeof v;
  if (t === "string") return v;
  if (t === "number" || t === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function buildData(payload = {}) {
  const data = {};

  // 1) payload’dagi hamma key/value’ni data’ga qo‘shamiz (string qilib)
  for (const [k, v] of Object.entries(payload)) {
    if (!k) continue;
    // notification/admin config kabi narsalar kelib qolsa yubormaymiz
    if (k === "android" || k === "apns" || k === "notification") continue;

    const s = toDataString(v);
    if (s === null) continue;
    data[k] = s;
  }

  // 2) Muhim default kalitlar doim bo‘lsin (Android parsing/compat uchun)
  data.notification_id = String(payload.notification_id ?? data.notification_id ?? "");
  data.trip_id = String(payload.trip_id ?? data.trip_id ?? "");
  data.thread_id = String(payload.thread_id ?? data.thread_id ?? "");
  data.title = String(payload.title ?? data.title ?? "");
  data.body = String(payload.body ?? data.body ?? "");
  data.type = String(payload.type ?? data.type ?? "GENERAL");

  return data;
}

async function sendToToken(token, payload) {
  initFcm();

  if (!token) throw new Error("FCM token is empty");

  return getMessaging().send({
    token,

    // ✅ Android: data-only push tezroq yetib kelishi uchun "high"
    android: {
      priority: "high",
      // TTL: offline bo‘lsa FCM qancha ushlab turadi (bu yerda 24h)
      ttl: 24 * 60 * 60 * 1000,
    },

    // iOS (kelajak uchun)
    apns: {
      payload: {
        aps: {
          contentAvailable: true,
        },
      },
      headers: {
        "apns-priority": "10",
      },
    },

    // ✅ ENG MUHIM: endi payload’dagi barcha extra data ham ketadi
    data: buildData(payload),
  });
}

module.exports = { sendToToken };
