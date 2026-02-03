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

module.exports = { list, markRead, markAllRead };
