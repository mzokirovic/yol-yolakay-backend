const service = require('./notifications.service');

function getUserId(req) {
  const uid = req.user?.id;
  if (!uid) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return uid;
}

exports.list = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const data = await service.listNotifications(userId);
    res.json({ success: true, count: data.length, data });
  } catch (e) { next(e); }
};

exports.markRead = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    await service.markRead(userId, id);
    res.json({ success: true });
  } catch (e) { next(e); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await service.markAllRead(userId);
    res.json({ success: true });
  } catch (e) { next(e); }
};

exports.registerToken = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { token } = req.body || {};

    if (!token || String(token).length < 20) {
      return res.status(400).json({ success: false, error: { message: "Token required" } });
    }

    await service.registerPushToken(userId, token);
    res.json({ success: true });
  } catch (e) { next(e); }
};

exports.testPush = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const result = await service.testPush(userId);
    res.json({ success: true, result });
  } catch (e) { next(e); }
};
