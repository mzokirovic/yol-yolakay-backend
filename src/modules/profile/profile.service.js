const repo = require('./profile.repo');

exports.getOrCreateProfile = async (userId) => {
  const existing = await repo.getProfileByUserId(userId);
  if (existing) return existing;

  // default profil
  return await repo.upsertProfile({
    user_id: userId,
    display_name: "Guest",
    phone: null,
    avatar_url: null,
    language: "uz",
  });
};

exports.updateProfile = async (userId, patch) => {
  // avval profil bo‘lsin
  await exports.getOrCreateProfile(userId);

  // patch -> db field mapping
  const dbPatch = {
    user_id: userId,
  };

  if (patch.displayName !== undefined) dbPatch.display_name = patch.displayName;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;
  if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;
  if (patch.language !== undefined) dbPatch.language = patch.language;

  return await repo.upsertProfile(dbPatch);
};

exports.getVehicle = async (userId) => {
  return await repo.getVehicleByUserId(userId);
};

exports.upsertVehicle = async (userId, patch) => {
  // Profil bo‘lishi shart emas, lekin yaxshi: profilni ham yaratib qo‘yamiz
  await exports.getOrCreateProfile(userId);

  const dbVehicle = {
    user_id: userId,
    make: patch.make ?? null,
    model: patch.model ?? null,
    color: patch.color ?? null,
    plate: patch.plate ?? null,
    seats: patch.seats ?? null,
  };

  return await repo.upsertVehicle(dbVehicle);
};
