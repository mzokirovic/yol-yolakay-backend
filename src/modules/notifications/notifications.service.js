const repo = require('./notifications.repo');

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

module.exports = {
  list,
  markRead,
  markAllRead,
  requireUserId,
};


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

module.exports = {
  list,
  markRead,
  markAllRead,
  registerPushToken,
  requireUserId,
};


async function registerToken(userId, token, platform = "android") {
  const { error } = await repo.upsertDeviceToken(userId, token, platform);
  if (error) throw error;
  return true;
}

module.exports = {
  list,
  markRead,
  markAllRead,
  requireUserId,
  registerToken,
};
