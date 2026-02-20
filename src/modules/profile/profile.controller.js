const service = require('./profile.service');
const supabase = require('../../core/db/supabase');

function getUserId(req) {
  const uid = req.user?.id;
  if (!uid) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return String(uid);
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

// -------- Compat: single vehicle --------

exports.getMyVehicle = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const vehicle = await service.getVehicle(userId);
    res.json(vehicle);
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

exports.deleteMyVehicle = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await service.deleteVehicle(userId);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

// -------- Public reference --------

exports.getCarReference = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('car_brands')
      .select('id, name, car_models ( id, name )');

    if (error) throw error;
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Car Ref Error:", error.message);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// -------- Legacy POST /vehicle (qoldiramiz, lekin service orqali) --------
exports.upsertVehicleDirect = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const b = req.body || {};
    const saved = await service.upsertVehicle(userId, b);
    return res.status(200).json({ success: true, message: "Mashina saqlandi", data: saved });
  } catch (e) {
    next(e);
  }
};

// -------- NEW: multi vehicles --------

exports.listMyVehicles = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const list = await service.listVehicles(userId);
    res.json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
};

exports.addMyVehicle = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const created = await service.addVehicle(userId, req.body || {});
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
};

exports.updateMyVehicleById = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const updated = await service.updateVehicleById(userId, id, req.body || {});
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

exports.deleteMyVehicleById = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    await service.deleteVehicleById(userId, id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

exports.setMyVehiclePrimary = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const updated = await service.setPrimaryVehicle(userId, id);
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};