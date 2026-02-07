// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

// Auth Client
const authUrl = process.env.SUPABASE_URL;
const authKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!authUrl || !authKey) {
    throw new Error("AUTH SERVICE ERROR: .env faylida kalitlar yo'q!");
}

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

// ✅ SEND OTP (O'ZGARDI: Plyusni olib tashlaymiz)
async function sendOtp(phone) {
    if (typeof phone !== 'string') {
        throw new Error("Phone must be a string");
    }

    // 1. RAQAMNI TOZALASH
    // Faqat raqamlarni qoldiramiz. Plyus (+), probel, tire - hammasi ketadi.
    // Masalan: "+998 90 123-45-67" -> "998901234567"
    let cleanPhone = phone.replace(/[^\d]/g, '');

    console.log(`🚀 Sending OTP via AuthClient to: '${cleanPhone}' (No Plus)`);

    const { data, error } = await authClient.auth.signInWithOtp({
        phone: cleanPhone,
    });

    if (error) {
        console.error("🔥 Supabase Auth Error:", error);
        throw error;
    }
    return data;
}

// ✅ VERIFY OTP (Bu yerda ham plyussiz tekshiramiz)
async function verifyOtp(req) {
  const body = req.body || {};
  let phone = body.phone;

  // Verify qilganda ham plyusni olib tashlaymiz
  if (phone) {
      phone = phone.replace(/[^\d]/g, '');
  }

  const code = body.code || body.token;

  if (!phone) throw badRequest("phone is required");
  if (!code) throw badRequest("code (or token) is required");

  console.log(`🔍 Verifying: ${phone} with code: ${code}`);

  const { data, error } = await authClient.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });

  if (error) throw error;

  const user = data.user;
  const session = data.session;

  if (!user || !session) throw badRequest("Auth verification failed (No session)");

  // Profilni tekshirish
  const { data: profile, error: profileError } = await dbClient
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