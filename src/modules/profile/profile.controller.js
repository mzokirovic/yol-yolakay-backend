const service = require('./profile.service');

function getUserId(req) {
  // ✅ 1) Agar Bearer token bilan kelsa (optionalAuth middleware qo'yilgan bo'lsa)
  const tokenUserId = req.user?.id;

  // ✅ 2) Eski Android flow (header("x-user-id", ...))
  const headerUserId = req.headers['x-user-id'];

  // ✅ 3) Guest/device flow (header("X-Device-Id", ...)) — BackendClient defaultRequest qo'shadi
  const deviceId = req.headers['x-device-id'];

  // ⚠️ 4) Vaqtincha dev fallback (keyin security uchun olib tashlaymiz)
  const queryUserId = req.query.userId;

  const userId = tokenUserId || headerUserId || deviceId || queryUserId;

  if (!userId) {
    const err = new Error("user id topilmadi (Bearer OR x-user-id OR x-device-id)");
    err.status = 400;
    throw err;
  }
  return String(userId);
}

exports.getMe = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const profile = await service.getOrCreateProfile(userId);
    res.json(profile);
  } catch (e) {
    next(e);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const { displayName, phone, avatarUrl, language } = req.body || {};

    const updated = await service.updateProfile(userId, {
      displayName,
      phone,
      avatarUrl,
      language,
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
};

exports.getMyVehicle = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const vehicle = await service.getVehicle(userId);
    res.json(vehicle); // null bo‘lishi mumkin
  } catch (e) {
    next(e);
  }
};

exports.upsertMyVehicle = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { make, model, color, plate, seats } = req.body || {};

    const saved = await service.upsertVehicle(userId, {
      make,
      model,
      color,
      plate,
      seats,
    });

    res.json(saved);
  } catch (e) {
    next(e);
  }
};
