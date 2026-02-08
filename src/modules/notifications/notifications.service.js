// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/notifications/notifications.service.js

const repo = require('./notifications.repo');
const { sendToToken } = require('../../core/fcm');

// req obyekti kerak emas, userId to'g'ridan-to'g'ri keladi
async function listNotifications(userId) {
  const limit = 50; 
  const { data, error } = await repo.listByUser(userId, limit);
  if (error) throw error;
  return data || [];
}

async function markRead(userId, id) {
  // Repo id va userId ni tekshiradi (xavfsizlik uchun)
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
  const platform = 'android'; // Hozircha default
  const { error } = await repo.upsertDeviceToken(userId, token, platform);
  if (error) throw error;
  return true;
}

async function testPush(userId) {
  const title = "Test Push";
  const body = "Bu test xabari";

  // 1) Tokenlarni olish
  const { data: tokens, error } = await repo.listDeviceTokens(userId);
  if (error) throw error;

  const tokenList = (tokens || []).map(t => t.token).filter(Boolean);
  if (!tokenList.length) return { sent: 0, reason: "No device tokens for user" };

  // 2) Bazaga yozish (va ID ni olish)
  const { data: created, error: createErr } = await repo.createNotification({
    user_id: userId,
    title,
    body,
    type: "TEST",
    is_read: false,
  });
  if (createErr) throw createErr;

  // 3) Jo‘natish (notification_id bilan)
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

  return { sent: ok, failed: fail, tokens: tokenList.length, notification_id: payload.notification_id };
}


module.exports = {
  listNotifications,
  markRead,
  markAllRead,
  registerPushToken,
  testPush
};