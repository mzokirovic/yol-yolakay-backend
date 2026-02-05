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
    await service.registerPushToken(req);
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function testPush(req, res, next) {
  try {
    const result = await service.testPush(req);
    res.json({ success: true, result });
  } catch (e) { next(e); }
}


module.exports = { list, markRead, markAllRead, registerToken, testPush };
