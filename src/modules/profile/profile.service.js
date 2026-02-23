const repo = require('./profile.repo');

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function normalizeVehicleInput(patch) {
  const make = String(patch.make || '').trim();
  const model = String(patch.model || '').trim();
  const color = String(patch.color || '').trim();
  const plate = String(patch.plate || '').trim().toUpperCase();
  const seats = Number.isFinite(Number(patch.seats)) ? Number(patch.seats) : 4;

  if (!make) throw badRequest("make majburiy");
  if (!model) throw badRequest("model majburiy");
  if (!color) throw badRequest("color majburiy");
  if (!plate) throw badRequest("plate majburiy");

  return { make, model, color, plate, seats };
}

// ✅ Tilni normalizatsiya qilish (faqat uz/ru/en)
function normalizeLanguage(code) {
  const v = String(code || '').trim().toLowerCase();
  if (v === 'uz') return 'uz';
  if (v === 'ru') return 'ru';
  if (v === 'en') return 'en';
  return null;
}

exports.getOrCreateProfile = async (userId) => {
  const existing = await repo.getProfileByUserId(userId);
  if (existing) return existing;

  return await repo.upsertProfile({
    user_id: userId,
    display_name: "Guest",
    phone: null,
    avatar_url: null,
    language: "uz",
  });
};

exports.updateProfile = async (userId, patch) => {
  await exports.getOrCreateProfile(userId);

  const p = patch || {};
  const dbPatch = { user_id: userId };

  // ✅ display_name NOT NULL: null/bo‘sh bo‘lsa update qilmaymiz
  if (p.displayName !== undefined && p.displayName !== null) {
    const dn = String(p.displayName).trim();
    if (dn.length > 0) dbPatch.display_name = dn;
  }

  // ✅ phone nullable: null bo‘lsa ham ruxsat (tozalash uchun)
  if (p.phone !== undefined) {
    dbPatch.phone = p.phone ?? null;
  }

  // ✅ avatar_url nullable: null bo‘lsa ham ruxsat (tozalash uchun)
  if (p.avatarUrl !== undefined) {
    dbPatch.avatar_url = p.avatarUrl ?? null;
  }

  // ✅ language NOT NULL: null/invalid bo‘lsa update qilmaymiz
  if (p.language !== undefined && p.language !== null) {
    const lang = normalizeLanguage(p.language);
    if (lang) dbPatch.language = lang;
  }

  return await repo.upsertProfile(dbPatch);
};

// -------- Compat single endpointlar --------

exports.getVehicle = async (userId) => {
  // repo ichida: primary user_vehicles -> bo‘lmasa vehicles
  return await repo.getVehicleByUserId(userId);
};

exports.upsertVehicle = async (userId, patch) => {
  await exports.getOrCreateProfile(userId);

  const v = normalizeVehicleInput(patch);

  // 1) Eski vehicles jadval (hozirgi app shuni o‘qiydi)
  const dbVehicle = {
    user_id: userId,
    make: v.make,
    model: v.model,
    color: v.color,
    plate: v.plate,
    seats: v.seats,
    updated_at: new Date().toISOString(),
  };

  const saved = await repo.upsertVehicle(dbVehicle);

  // 2) Multi jadvalga ham primary sifatida sync (jadval bo‘lmasa jim turadi)
  await repo.upsertPrimaryUserVehicle(userId, {
    make: v.make,
    model: v.model,
    color: v.color,
    plate: v.plate,
    seats: v.seats,
  });

  return saved;
};

exports.deleteVehicle = async (userId) => {
  // 1) eski jadvaldan o‘chiramiz
  await repo.deleteVehicleByUserId(userId);

  // 2) multi jadvalda primary ham o‘chsin (compat)
  await repo.deletePrimaryUserVehicle(userId);

  return true;
};

// -------- Multi vehicles (yangi) --------

exports.listVehicles = async (userId) => {
  const rows = await repo.listUserVehiclesByUserId(userId);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    make: r.make,
    model: r.model,
    color: r.color,
    plate: r.plate,
    seats: r.seats,
    isPrimary: !!r.is_primary,
    updatedAt: r.updated_at,
  }));
};

exports.addVehicle = async (userId, patch) => {
  await exports.getOrCreateProfile(userId);
  const v = normalizeVehicleInput(patch);

  const existing = await repo.listUserVehiclesByUserId(userId);
  const hasPrimary = existing.some((x) => x.is_primary);

  const wantPrimary = patch.isPrimary === true || !hasPrimary;

  if (wantPrimary) {
    await repo.clearPrimaryForUser(userId);
  }

  const inserted = await repo.insertUserVehicle({
    user_id: userId,
    make: v.make,
    model: v.model,
    color: v.color,
    plate: v.plate,
    seats: v.seats,
    is_primary: wantPrimary,
    updated_at: new Date().toISOString(),
  });

  // Agar primary bo‘lsa, eski vehicles jadvalni ham shu bilan sync qilamiz (app uchun)
  if (wantPrimary && inserted) {
    await repo.upsertVehicle({
      user_id: userId,
      make: v.make,
      model: v.model,
      color: v.color,
      plate: v.plate,
      seats: v.seats,
      updated_at: new Date().toISOString(),
    });
  }

  return inserted;
};

exports.updateVehicleById = async (userId, id, patch) => {
  // patch: make/model/color/plate/seats/isPrimary bo‘lishi mumkin
  const current = await repo.getUserVehicleById(userId, id);
  if (!current) throw badRequest("vehicle topilmadi");

  const merged = {
    make: patch.make ?? current.make,
    model: patch.model ?? current.model,
    color: patch.color ?? current.color,
    plate: patch.plate ?? current.plate,
    seats: patch.seats ?? current.seats,
  };
  const v = normalizeVehicleInput(merged);

  const wantPrimary = patch.isPrimary === true;

  if (wantPrimary) {
    await repo.clearPrimaryForUser(userId);
  }

  const updated = await repo.updateUserVehicleById(userId, id, {
    make: v.make,
    model: v.model,
    color: v.color,
    plate: v.plate,
    seats: v.seats,
    ...(wantPrimary ? { is_primary: true } : {}),
    updated_at: new Date().toISOString(),
  });

  // Agar yangilangan vehicle primary bo‘lsa (yoki oldin primary bo‘lgan bo‘lsa) — eski jadvalni sync qilamiz
  const primary = await repo.getPrimaryUserVehicleByUserId(userId);
  if (primary) {
    await repo.upsertVehicle({
      user_id: userId,
      make: primary.make,
      model: primary.model,
      color: primary.color,
      plate: primary.plate,
      seats: primary.seats,
      updated_at: new Date().toISOString(),
    });
  }

  return updated;
};

exports.deleteVehicleById = async (userId, id) => {
  const current = await repo.getUserVehicleById(userId, id);
  if (!current) return true;

  const wasPrimary = !!current.is_primary;

  await repo.deleteUserVehicleById(userId, id);

  if (wasPrimary) {
    const left = await repo.listUserVehiclesByUserId(userId);
    const next = left[0]; // is_primary desc bo‘yicha sort bo‘lgani uchun 0-chi “eng yaqin”
    if (next?.id) {
      await repo.setPrimaryUserVehicle(userId, next.id);
      // eski jadvalni sync
      await repo.upsertVehicle({
        user_id: userId,
        make: next.make,
        model: next.model,
        color: next.color,
        plate: next.plate,
        seats: next.seats,
        updated_at: new Date().toISOString(),
      });
    } else {
      // hech narsa qolmadi -> eski jadvalni ham o‘chirib yuboramiz
      await repo.deleteVehicleByUserId(userId);
    }
  }

  return true;
};

exports.setPrimaryVehicle = async (userId, id) => {
  const updated = await repo.setPrimaryUserVehicle(userId, id);
  if (!updated) throw badRequest("vehicle topilmadi");

  // eski jadvalni sync (app uchun)
  await repo.upsertVehicle({
    user_id: userId,
    make: updated.make,
    model: updated.model,
    color: updated.color,
    plate: updated.plate,
    seats: updated.seats,
    updated_at: new Date().toISOString(),
  });

  return updated;
};