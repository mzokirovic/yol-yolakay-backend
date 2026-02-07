// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/notifications/notifications.controller.js

const service = require('./notifications.service');

// User ID ni headerdan olish
function getUserId(req) {
  const userId = req.headers['x-user-id'];

  if (!userId) {
      // Agar token bo'lsa
      if (req.user && req.user.id) return req.user.id;

      const err = new Error("Unauthorized (User ID missing)");
      err.status = 401;
      throw err;
  }
  return String(userId);
}

// 1. Ro'yxatni olish (GET /)
exports.list = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    // Servicega REQ emas, USERID beramiz
    const data = await service.listNotifications(userId);
    res.json({ success: true, count: data.length, data });
  } catch (e) {
    next(e);
  }
};

// 2. O'qilgan deb belgilash (POST /:id/read)
exports.markRead = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    await service.markRead(userId, id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

// 3. Hammasini o'qilgan deb belgilash (POST /read-all)
exports.markAllRead = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await service.markAllRead(userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

// 4. Push tokenni saqlash (POST /token)
exports.registerToken = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ success: false, error: { message: "Token required" } });
    }

    await service.registerPushToken(userId, token);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

// 5. Test Push (POST /test)
exports.testPush = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const result = await service.testPush(userId);
        res.json({ success: true, result });
    } catch (e) {
        next(e);
    }
};