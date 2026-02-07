// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/profile/profile.controller.js

const service = require('./profile.service');
const supabase = require('../../core/db/supabase');

function getUserId(req) {
  // 1) Token
  const tokenUserId = req.user?.id;
  // 2) Header
  const headerUserId = req.headers['x-user-id'];
  // 3) Device ID
  const deviceId = req.headers['x-device-id'];

  const userId = tokenUserId || headerUserId || deviceId;

  if (!userId) {
    const err = new Error("Siz tizimga kirmagansiz (User ID topilmadi)");
    err.status = 401;
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

// ✅ Logdagi xatoni oldini olish uchun bu funksiya aniq bo'lishi shart
exports.getCarReference = async (req, res, next) => {
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

// ✅ POST /vehicle marshruti uchun funksiya
exports.upsertVehicleDirect = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const b = req.body;

        // Validatsiya
        if (!b.make || !b.model || !b.plate) {
            return res.status(400).json({ success: false, error: { message: "Mashina ma'lumotlari to'liq emas" } });
        }

        const vehicleData = {
            user_id: userId,
            make: b.make,
            model: b.model,
            color: b.color,
            plate: b.plate,
            seats: parseInt(b.seats || 4)
        };

        const { data, error } = await supabase
            .from('vehicles')
            .upsert(vehicleData)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, message: "Mashina saqlandi", data });
    } catch (error) {
        next(error);
    }
};