// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase'); // Bu DB uchun (Admin)

// ✅ MAXSUS AUTH CLIENT (Faqat Auth uchun)
// Bizga "Anon Key" kerak, chunki signInWithOtp foydalanuvchi nomidan bajariladi.
const authUrl = process.env.SUPABASE_URL;
const authKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!authUrl || !authKey) {
    throw new Error("AUTH SERVICE ERROR: .env faylida SUPABASE_ANON_KEY yo'q!");
}

// Auth uchun alohida sozlamalar bilan klient
const authClient = createClient(authUrl, authKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
});

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

// ✅ SEND OTP
async function sendOtp(phone) {
    if (typeof phone !== 'string') {
        throw new Error("Phone must be a string");
    }

    console.log("🚀 Sending OTP via AuthClient to:", phone);

    // AuthClient orqali yuboramiz (Admin orqali emas!)
    const { data, error } = await authClient.auth.signInWithOtp({
        phone: phone,
        // Agar Test Nomer bo'lsa, options shart emas.
        // Agar real bo'lsa, bu yerda captcha options bo'lishi mumkin.
    });

    if (error) {
        console.error("🔥 Supabase Auth Error:", error);
        throw error;
    }
    return data;
}

// ✅ VERIFY OTP
async function verifyOtp(req) {
  // Android "token" yuborishi mumkin, Controller "code" deb o'ylashi mumkin.
  // Ikkalasini ham tekshiramiz.
  const body = req.body || {};
  const phone = body.phone;
  const code = body.code || body.token; // Universal yechim

  if (!phone) throw badRequest("phone is required");
  if (!code) throw badRequest("code (or token) is required");

  console.log(`🔍 Verifying: ${phone} with code: ${code}`);

  // 1. Verify
  const { data, error } = await authClient.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });

  if (error) throw error;

  const user = data.user;
  const session = data.session;

  if (!user || !session) throw badRequest("Auth verification failed (No session)");

  // 2. Profilni tekshirish (Endi DB Client ishlatamiz, chunki u Admin)
  const { data: profile, error: profileError } = await dbClient
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  // Agar profil bo'lmasa -> Yangi User
  const isNewUser = !profile;

  return {
    userId: user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    isNewUser: isNewUser,
  };
}

module.exports = { sendOtp, verifyOtp };