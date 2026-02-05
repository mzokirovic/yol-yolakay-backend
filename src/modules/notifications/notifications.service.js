const repo = require('./notifications.repo');
const { sendToToken } = require('../../core/fcm');

function requireActorId(req) {
  const uid =
    req.actorId ||
    req.user?.id ||
    req.header('x-user-id') ||
    req.header('x-device-id');

  if (!uid) {
    const err = new Error('actor id is required (Authorization Bearer OR x-user-id OR x-device-id)');
    err.statusCode = 400;
    throw err;
  }
  return uid;
}

async function list(req) {
  const uid = requireActorId(req);
  const limit = Math.min(Number(req.query.limit || 50), 100);

  const { data, error } = await repo.listByUser(uid, limit);
  if (error) throw error;

  return data || [];
}

async function markRead(req) {
  const uid = requireActorId(req);
  const id = req.params.id;

  const { data, error } = await repo.markRead(uid, id);
  if (error) throw error;

  return data;
}

async function markAllRead(req) {
  const uid = requireActorId(req);

  const { error } = await repo.markAllRead(uid);
  if (error) throw error;

  return true;
}

async function registerPushToken(req) {
  const uid = requireActorId(req);
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
  const uid = requireActorId(req);
  const { title = "Test", body = "Hello" } = req.body || {};

  const { data: tokens, error } = await repo.listDeviceTokens(uid);
  if (error) throw error;

  const tokenList = (tokens || []).map(t => t.token).filter(Boolean);
  if (!tokenList.length) return { sent: 0, reason: "No device tokens for actor" };

  await repo.createNotification({
    user_id: uid,   // ✅ shu ustun oldin ham deviceId saqlagan, endi userId ham saqlaydi
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
  requireActorId,
  list,
  markRead,
  markAllRead,
  registerPushToken,
  testPush
};
