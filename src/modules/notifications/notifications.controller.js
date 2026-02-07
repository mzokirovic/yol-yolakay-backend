// src/modules/notifications/notifications.controller.js

const service = require('./notifications.service');

function getUserId(req) {
  // 🚨 O'ZGARISH: Faqat Headerdan olinadi. Query param (URL) dan olish taqiqlandi.
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
      if (req.user && req.user.id) return req.user.id;
      // Agar ID bo'lmasa, Notification ko'rsatib bo'lmaydi
      const err = new Error("Unauthorized (User ID missing)");
      err.status = 401;
      throw err;
  }
  return String(userId);
}

exports.listNotifications = async (req, res) => {
  try {
    const userId = getUserId(req);
    const list = await service.listNotifications(userId);
    return res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.markRead = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    await service.markRead(id); // userId kerak emas, id unique
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.registerPushToken = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: { message: "Token required" } });

    await service.registerPushToken(userId, token);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};