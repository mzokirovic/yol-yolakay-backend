// /src/modules/inbox/inbox.controller.js
const service = require('./inbox.service');

function getUserId(req) {
  const uid = req.user?.id; // ✅ JWT dan
  if (!uid) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return String(uid);
}

exports.listThreads = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const data = await service.listThreads(userId);
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (e) { next(e); }
};

exports.createThread = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { peerId, tripId } = req.body || {};
    if (!peerId) return res.status(400).json({ success: false, error: { message: "peerId required" } });

    const thread = await service.createThread({
      userId,
      peerId: String(peerId),
      tripId: tripId ? String(tripId) : null
    });
    return res.status(201).json({ success: true, thread });
  } catch (e) { next(e); }
};

exports.getThread = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const data = await service.getThread({ userId, threadId: id });
    return res.status(200).json({ success: true, thread: data.thread, messages: data.messages });
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ success: false, error: { message: e.message } });
    next(e);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, error: { message: "text required" } });
    }

    const msg = await service.sendMessage({ userId, threadId: id, text: String(text).trim() });
    return res.status(201).json({ success: true, message: msg });
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ success: false, error: { message: e.message } });
    next(e);
  }
};
