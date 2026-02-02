const service = require('./inbox.service');

function getUserId(req) {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) return null;
  return String(userId);
}

exports.listThreads = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: { message: "x-user-id required" } });

    const data = await service.listThreads(userId);
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.createThread = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: { message: "x-user-id required" } });

    const { peerId, tripId } = req.body || {};
    if (!peerId) return res.status(400).json({ success: false, error: { message: "peerId required" } });

    const thread = await service.createThread({ userId, peerId: String(peerId), tripId: tripId ? String(tripId) : null });
    return res.status(201).json({ success: true, thread });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.getThread = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: { message: "x-user-id required" } });

    const { id } = req.params;
    const data = await service.getThread({ userId, threadId: id });

    return res.status(200).json({ success: true, thread: data.thread, messages: data.messages });
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ success: false, error: { message: e.message } });
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: { message: "x-user-id required" } });

    const { id } = req.params;
    const { text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, error: { message: "text required" } });
    }

    const msg = await service.sendMessage({ userId, threadId: id, text: String(text).trim() });
    return res.status(201).json({ success: true, message: msg });
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ success: false, error: { message: e.message } });
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};
