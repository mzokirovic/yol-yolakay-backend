// src/modules/notifications/notifications.service.js

const repo = require('./notifications.repo');
const { sendToToken } = require('../../core/fcm');

async function listNotifications(userId) {
  const limit = 50;
  const { data, error } = await repo.listByUser(userId, limit);
  if (error) throw error;
  return data || [];
}

async function markRead(userId, id) {
  const { data, error } = await repo.markRead(userId, id);
  if (error) throw error;
  return data;
}

async function markAllRead(userId) {
  const { error } = await repo.markAllRead(userId);
  if (error) throw error;
  return true;
}

async function registerPushToken(userId, token) {
  const platform = 'android';
  const { error } = await repo.upsertDeviceToken(userId, token, platform);
  if (error) throw error;
  return true;
}

async function testPush(userId) {
  const title = "Test Push";
  const body = "Bu test xabari";

  const { data: tokens, error } = await repo.listDeviceTokens(userId);
  if (error) throw error;

  const tokenList = (tokens || []).map(t => t.token).filter(Boolean);
  if (!tokenList.length) return { sent: 0, reason: "No device tokens for user" };

  const { data: created, error: createErr } = await repo.createNotification({
    user_id: userId,
    title,
    body,
    type: "TEST",
    is_read: false,
  });
  if (createErr) throw createErr;

  const payload = {
    notification_id: String(created?.id ?? ""),
    title,
    body,
    type: "TEST",
  };

  let ok = 0, fail = 0;
  for (const t of tokenList) {
    try {
      await sendToToken(t, payload);
      ok++;
    } catch (e) {
      fail++;
      console.error("FCM_SEND_FAIL", e.message);
    }
  }

  return {
    sent: ok,
    failed: fail,
    tokens: tokenList.length,
    notification_id: payload.notification_id
  };
}

/**
 * ✅ REAL APP CORE:
 * Har event -> 1) notifications table (in-app history)
 *            -> 2) push (FCM) (notification_id bilan)
 */
async function createAndPush(userId, title, body, type, data = {}) {
  // 1) in-app record
  const { data: created, error: createErr } = await repo.createNotification({
    user_id: userId,
    title,
    body,
    type,
    is_read: false,
  });
  if (createErr) throw createErr;

  const notification_id = String(created?.id ?? "");

  // 2) tokens
  const { data: tokens, error: tokErr } = await repo.listDeviceTokens(userId);
  if (tokErr) throw tokErr;

  const tokenList = (tokens || []).map(t => t.token).filter(Boolean);
  if (!tokenList.length) {
    return { notification_id, sent: 0, reason: "No device tokens" };
  }

  // 3) push
  const payload = { notification_id, title, body, type, ...data };

  const results = await Promise.allSettled(
    tokenList.map(t => sendToToken(t, payload))
  );

  // ✅ invalid tokenlarni tozalash
  let removed = 0;
  await Promise.allSettled(
    results.map((r, i) => {
      if (r.status !== "rejected") return Promise.resolve();

      const err = r.reason;
      const code = err?.errorInfo?.code || err?.code || "";

      const isInvalid =
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token";

      if (!isInvalid) return Promise.resolve();

      const badToken = tokenList[i];
      return repo.deleteDeviceToken(userId, badToken)
        .then(() => { removed++; })
        .catch(() => {});
    })
  );

  const ok = results.filter(r => r.status === "fulfilled").length;
  const fail = results.length - ok;

  return { notification_id, sent: ok, failed: fail, tokens: tokenList.length, removed };
}


module.exports = {
  listNotifications,
  markRead,
  markAllRead,
  registerPushToken,
  testPush,
  createAndPush,
};
