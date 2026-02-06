const service = require('./profile.service');
const supabase = require('../../core/db/supabase'); // ✅ YANGI: Reference data olish uchun

function getUserId(req) {
  // ✅ 1) Agar Bearer token bilan kelsa (optionalAuth middleware qo'yilgan bo'lsa)
  const tokenUserId = req.user?.id;

  // ✅ 2) Eski Android flow (header("x-user-id", ...))
  const headerUserId = req.headers['x-user-id'];

  // ✅ 3) Guest/device flow (header("X-Device-Id", ...))
  const deviceId = req.headers['x-device-id'];

  // ⚠️ 4) Vaqtincha dev fallback
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
    res.json(vehicle);
  } catch (e) {
    next(e);
  }
};

// Mavjud upsertMyVehicle (Service orqali ishlaydi)
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

// ✅ YANGI: Mashina turlarini olish (Brendlar va Modellar)
exports.getCarReference = async (req, res, next) => {
  try {
    // Brandlarni modellari bilan birga olamiz (Nested Query)
    const { data, error } = await supabase
      .from('car_brands')
      .select('id, name, car_models ( id, name )');

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (error) {
    // Agar baza hali tayyor bo'lmasa yoki xato bo'lsa
    console.error("Car Ref Error:", error.message);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// ✅ YANGI: To'g'ridan-to'g'ri Controller orqali saqlash (Alternativ variant)
// Agar service.js da upsertVehicle bo'lsa, tepadagi upsertMyVehicle yetarli.
// Lekin biz "profile/vehicle" endpointi uchun buni ham qo'shib qo'yamiz.
exports.upsertVehicleDirect = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const b = req.body;

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