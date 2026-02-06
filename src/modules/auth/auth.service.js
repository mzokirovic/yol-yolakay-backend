const supabase = require('../../core/db/supabase');

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

// ... sendOtp o'zgarishsiz qoladi ...

async function verifyOtp(req) {
  const { phone, code } = req.body || {};
  if (!phone) throw badRequest("phone is required");
  if (!code) throw badRequest("code is required");

  // 1. Supabase Auth orqali tekshirish
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });
  if (error) throw error;

  const user = data.user;
  const session = data.session;

  if (!user || !session) throw badRequest("Auth failed");

  // 2. SENIOR FIX: Public Profile borligini tekshiramiz
  // Biz "Auth" slice ichidamiz, lekin "Profile" slice ma'lumotini o'qiyapmiz.
  // Bu Read-Only bo'lgani uchun Vertical Slice prinsipini buzmaydi.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  // Agar profil topilmasa, demak bu YANGI USER
  const isNewUser = !profile;

  return {
    userId: user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    isNewUser: isNewUser, // <-- UI ga signal yuboramiz
  };
}

module.exports = { sendOtp, verifyOtp }; // sendOtp ni ham qo'shib qo'ying