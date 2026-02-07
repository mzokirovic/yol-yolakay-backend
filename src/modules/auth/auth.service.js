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

// ✅ SEND OTP
async function sendOtp(phone) {
    if (typeof phone !== 'string') {
        throw new Error("Phone must be a string");
    }

    console.log(`original phone input: '${phone}'`);

    // 1. TOZALASH: Barcha begona belgilarni olib tashlaymiz
    let cleanPhone = phone.replace(/[^\d]/g, '');

    // 2. FORMATLASH: Majburan + qo'shamiz
    // Natija har doim: +998901234567
    const finalPhone = `+${cleanPhone}`;

    console.log(`🚀 YUBORILAYOTGAN RAQAM (SUPABASEGA): '${finalPhone}'`);

    const { data, error } = await authClient.auth.signInWithOtp({
        phone: finalPhone,
    });

    if (error) {
        console.error("🔥 Supabase Auth Error:", error.message);
        // Agar Twilio xatosi bo'lsa, demak raqam Test ro'yxatida yo'q!
        if (error.message.includes("Twilio") || error.status === 500) {
            throw new Error(`CRITICAL: Supabase bu raqamni (${finalPhone}) Test Raqam deb tanimadi! Dashboardni tekshiring.`);
        }
        throw error;
    }

    console.log("✅ Supabase qabul qildi. SMS yuborilmadi (Test mode).");
    return data;
}

// ✅ VERIFY OTP
async function verifyOtp(req) {
  const body = req.body || {};
  let phone = body.phone;

  // Verify qilganda ham xuddi shunday formatlaymiz
  if (phone) {
      const clean = phone.replace(/[^\d]/g, '');
      phone = `+${clean}`;
  }

  const code = body.code || body.token;

  if (!phone) throw badRequest("phone is required");
  if (!code) throw badRequest("code (or token) is required");

  console.log(`🔍 Verifying: '${phone}' with code: '${code}'`);

  const { data, error } = await authClient.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });

  if (error) throw error;

  const user = data.user;
  const session = data.session;

  if (!user || !session) throw badRequest("Auth verification failed (No session)");

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