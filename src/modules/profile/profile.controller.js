const service = require('./profile.service');

function getUserId(req) {
  // Android’dan yuboramiz: header("x-user-id", ...)
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    const err = new Error("x-user-id yuborilmadi (yoki ?userId=...)");
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
