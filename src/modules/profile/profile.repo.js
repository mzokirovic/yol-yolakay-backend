const supabase = require('../../core/db/supabase');

function mapProfile(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    displayName: row.display_name,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    language: row.language,
    updatedAt: row.updated_at,
  };
}

function mapVehicle(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    make: row.make,
    model: row.model,
    color: row.color,
    plate: row.plate,
    seats: row.seats,
    updatedAt: row.updated_at,
  };
}

// -------- Profiles --------

exports.getProfileByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return mapProfile(data);
};

exports.upsertProfile = async (dbProfile) => {
  // ✅ MUHIM: Supabase upsert kelmagan fieldlarni ham NULL qilib yuborishi mumkin.
  // Shuning uchun display_name NOT NULL bo'lsa:
  // - update patchda display_name yo'q bo'lsa, DB dagi eski qiymatni saqlab qolamiz.
  // - agar umuman profil bo'lmasa, "Guest" qo'yamiz.

  // dbProfile: { user_id, display_name?, phone?, avatar_url?, language?, updated_at? }

  // 1) display_name kelmagan bo'lsa, avval hozirgi profilni olib olamiz
  if (dbProfile.display_name === undefined) {
    const { data: existing, error: getErr } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', dbProfile.user_id)
      .maybeSingle();

    if (getErr) throw getErr;

    dbProfile.display_name = existing?.display_name ?? "Guest";
  }

  // 2) Endi upsert xavfsiz: display_name hech qachon NULL bo'lmaydi
  const { data, error } = await supabase
    .from('profiles')
    .upsert(dbProfile, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapProfile(data);
};

// -------- SINGLE vehicle table: public.vehicles (compat) --------

async function getVehicleSingleByUserId(userId) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return mapVehicle(data);
}

exports.upsertVehicle = async (dbVehicle) => {
  const { data, error } = await supabase
    .from('vehicles')
    .upsert(dbVehicle, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapVehicle(data);
};

exports.deleteVehicleByUserId = async (userId) => {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
  return true;
};

// -------- MULTI vehicle table: public.user_vehicles --------
// Eslatma: agar jadval hali yaratib ulgurilmagan bo‘lsa,
// “relation does not exist” bo‘lishi mumkin. Shuning uchun ehtiyotkor wrapper qilamiz.

function isMissingTableError(e, tableName) {
  const msg = (e && e.message) ? e.message : '';
  return msg.toLowerCase().includes(tableName.toLowerCase()) && msg.toLowerCase().includes('does not exist');
}

exports.listUserVehiclesByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('user_vehicles')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingTableError(error, 'user_vehicles')) return [];
    throw error;
  }
  return data || [];
};

exports.getPrimaryUserVehicleByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('user_vehicles')
    .select('*')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'user_vehicles')) return null;
    throw error;
  }
  return data || null;
};

exports.getUserVehicleById = async (userId, id) => {
  const { data, error } = await supabase
    .from('user_vehicles')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, 'user_vehicles')) return null;
    throw error;
  }
  return data || null;
};

exports.insertUserVehicle = async (dbRow) => {
  const { data, error } = await supabase
    .from('user_vehicles')
    .insert(dbRow)
    .select('*')
    .single();

  if (error) {
    if (isMissingTableError(error, 'user_vehicles')) return null;
    throw error;
  }
  return data;
};

exports.updateUserVehicleById = async (userId, id, patch) => {
  const { data, error } = await supabase
    .from('user_vehicles')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (isMissingTableError(error, 'user_vehicles')) return null;
    throw error;
  }
  return data;
};

exports.deleteUserVehicleById = async (userId, id) => {
  const { error } = await supabase
    .from('user_vehicles')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (error) {
    if (isMissingTableError(error, 'user_vehicles')) return true;
    throw error;
  }
  return true;
};

exports.clearPrimaryForUser = async (userId) => {
  const { error } = await supabase
    .from('user_vehicles')
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_primary', true);

  if (error) {
    if (isMissingTableError(error, 'user_vehicles')) return true;
    throw error;
  }
  return true;
};

exports.setPrimaryUserVehicle = async (userId, id) => {
  // Minimal (2 query): avval eski primary’ni o‘chiramiz, keyin yangi primary qilamiz
  await exports.clearPrimaryForUser(userId);
  const { data, error } = await supabase
    .from('user_vehicles')
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (isMissingTableError(error, 'user_vehicles')) return null;
    throw error;
  }
  return data;
};

// -------- Unified getter (compat): birinchi primary user_vehicles, bo‘lmasa vehicles --------

exports.getVehicleByUserId = async (userId) => {
  // 1) multi jadvaldan primary
  try {
    const primary = await exports.getPrimaryUserVehicleByUserId(userId);
    if (primary) return mapVehicle(primary);
  } catch (e) {
    // jadval yo‘q bo‘lsa / boshqa muammo bo‘lsa fallback
  }

  // 2) eski single jadval
  return await getVehicleSingleByUserId(userId);
};

// -------- Helper: primary’ni upsert qilish (old endpointlar uchun sync) --------

exports.upsertPrimaryUserVehicle = async (userId, dbRow) => {
  try {
    const current = await exports.getPrimaryUserVehicleByUserId(userId);
    if (current?.id) {
      return await exports.updateUserVehicleById(userId, current.id, {
        ...dbRow,
        is_primary: true,
        updated_at: new Date().toISOString(),
      });
    }
    // primary yo‘q bo‘lsa insert
    return await exports.insertUserVehicle({
      ...dbRow,
      user_id: userId,
      is_primary: true,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    // user_vehicles yo‘q bo‘lsa ignore (compat)
    if (isMissingTableError(e, 'user_vehicles')) return null;
    throw e;
  }
};

exports.deletePrimaryUserVehicle = async (userId) => {
  // primary’larni o‘chirib tashlaymiz (minimal)
  const { error } = await supabase
    .from('user_vehicles')
    .delete()
    .eq('user_id', userId)
    .eq('is_primary', true);

  if (error) {
    if (isMissingTableError(error, 'user_vehicles')) return true;
    throw error;
  }
  return true;
};