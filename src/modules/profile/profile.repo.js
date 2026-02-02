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
  const { data, error } = await supabase
    .from('profiles')
    .upsert(dbProfile, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapProfile(data);
};

exports.getVehicleByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return mapVehicle(data);
};

exports.upsertVehicle = async (dbVehicle) => {
  const { data, error } = await supabase
    .from('vehicles')
    .upsert(dbVehicle, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapVehicle(data);
};
