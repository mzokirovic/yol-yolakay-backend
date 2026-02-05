const repo = require('./notifications.repo');
const repo = require('./notifications.repo');
const { sendToToken } = require('../../core/fcm');

function requireUserId(req) {
  const uid = req.header('x-user-id');
  if (!uid) {
    const err = new Error('x-user-id header is required');
    err.statusCode = 400;
    throw err;
  }
  return uid;
}

async function list(req) {
  const uid = requireUserId(req);
  const limit = Math.min(Number(req.query.limit || 50), 100);

  const { data, error } = await repo.listByUser(uid, limit);
  if (error) throw error;

  return data || [];
}

async function markRead(req) {
  const uid = requireUserId(req);
  const id = req.params.id;

  const { data, error } = await repo.markRead(uid, id);
  if (error) throw error;

  return data;
}

async function markAllRead(req) {
  const uid = requireUserId(req);

  const { error } = await repo.markAllRead(uid);
  if (error) throw error;

  return true;
}

/**
 * ✅ Route: POST /api/notifications/token
 * Header: x-user-id
 * Body: { token, platform }
 */
async function registerPushToken(req) {
  const uid = requireUserId(req);
  const { token, platform = 'android' } = req.body || {};

  if (!token) {
    const err = new Error('token is required');
    err.statusCode = 400;
    throw err;
  }

  const { error } = await repo.upsertDeviceToken(uid, token, platform);
  if (error) throw error;

  return true;
}

async function testPush(req) {
  const uid = requireUserId(req);
  const { title = "Test", body = "Hello" } = req.body || {};

  const { data: tokens, error } = await repo.listDeviceTokens(uid);
  if (error) throw error;

  const tokenList = (tokens || []).map(t => t.token).filter(Boolean);
  if (!tokenList.length) return { sent: 0, reason: "No device tokens for user" };

  // DB ga ham yozib qo'yamiz (polling bilan ham ko'rinadi)
  await repo.createNotification({
    user_id: uid,
    title,
    body,
    type: "TEST",
    is_read: false,
  });

  let ok = 0, fail = 0;
  for (const t of tokenList) {
    try { await sendToToken(t, { title, body }); ok++; }
    catch (e) { fail++; console.error("FCM_SEND_FAIL", e); }
  }

  return { sent: ok, failed: fail, tokens: tokenList.length };
}


module.exports = {
  requireUserId,
  list,
  markRead,
  markAllRead,
  registerPushToken,
  testPush
};
