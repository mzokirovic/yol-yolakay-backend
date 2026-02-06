const supabase = require('../../core/db/supabase');

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

// ✅ sendOtp: Faqat telefon raqam stringini qabul qiladi
async function sendOtp(phone) {
    // Phone string ekanligiga ishonch hosil qilish
    if (typeof phone !== 'string') {
        throw new Error("Service sendOtp expects a string phone number");
    }

    const { data, error } = await supabase.auth.signInWithOtp({
        phone: phone
    });

    if (error) throw error;
    return data;
}

// ✅ verifyOtp: Hozircha req qabul qilyapti (Controllerdan kelayotgan)
async function verifyOtp(req) {
  const { phone, code } = req.body || {};

  if (!phone) throw badRequest("phone is required");
  if (!code) throw badRequest("code is required");

  // 1. Supabase Auth Verify
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });

  if (error) throw error;

  const user = data.user;
  const session = data.session;

  if (!user || !session) throw badRequest("Auth failed");

  // 2. Profil borligini tekshirish
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  const isNewUser = !profile;

  return {
    userId: user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    isNewUser: isNewUser,
  };
}

module.exports = { sendOtp, verifyOtp };