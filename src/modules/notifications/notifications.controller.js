const service = require('./notifications.service');

async function list(req, res, next) {
  try {
    const data = await service.list(req);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function markRead(req, res, next) {
  try {
    const data = await service.markRead(req);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function markAllRead(req, res, next) {
  try {
    await service.markAllRead(req);
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function registerToken(req, res, next) {
  try {
    const userId = req.header("x-user-id");
    const { token, platform = "android" } = req.body || {};
    if (!userId || !token) return res.status(400).json({ success:false, error:"userId/token required" });

    await service.registerToken(userId, token, platform);
    res.json({ success: true });
  } catch (e) { next(e); }
}


module.exports = { list, markRead, markAllRead, registerToken };
