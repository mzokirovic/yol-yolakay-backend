// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

// 1. URL va KEY borligini tekshiramiz
const authUrl = process.env.SUPABASE_URL;
const authKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!authUrl || !authKey) {
    throw new Error("KRITIK XATO: .env faylida SUPABASE_URL yoki KEY yo'q!");
}

// 2. Auth Client yaratamiz
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

// ✅ SEND OTP (Mantiq: Tozalash -> Plyuslash -> Yuborish)
async function sendOtp(phone) {
    if (typeof phone !== 'string') {
        throw new Error("Phone must be a string");
    }

    console.log(`📡 Ilovadan keldi: '${phone}'`);

    // A) TOZALASH: Faqat raqamlarni qoldiramiz
    let cleanPhone = phone.replace(/[^\d]/g, '');

    // B) FORMATLASH: Har doim boshiga + qo'shamiz
    // Supabase bazasida raqamlar + bilan saqlanadi (garchi UI da ko'rinmasa ham)
    const finalPhone = `+${cleanPhone}`;

    console.log(`🚀 Supabasega yuborilyapti: '${finalPhone}'`);

    const { data, error } = await authClient.auth.signInWithOtp({
        phone: finalPhone,
    });

    if (error) {
        console.error("🔥 Supabase Xatosi:", error.message);
        console.error("💡 Maslahat: Agar 'Twilio' xatosi chiqsa, demak Supabase Dashboardda bu raqam TEST ro'yxatida yo'q!");
        throw error;
    }

    console.log("✅ Muvaffaqiyatli! SMS yuborilmadi (Test Mode).");
    return data;
}

// ✅ VERIFY OTP
async function verifyOtp(req) {
  const body = req.body || {};
  let phone = body.phone;
  const code = body.code || body.token;

  if (phone) {
      // Verify paytida ham xuddi shu format: +15551234567
      const clean = phone.replace(/[^\d]/g, '');
      phone = `+${clean}`;
  }

  if (!phone) throw badRequest("phone is required");
  if (!code) throw badRequest("code is required");

  console.log(`🔍 Tekshirilyapti: '${phone}' kod: '${code}'`);

  const { data, error } = await authClient.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });

  if (error) throw error;

  const user = data.user;
  const session = data.session;

  if (!user || !session) throw badRequest("Auth verification failed");

  // Profilni tekshirish
  const { data: profile } = await dbClient
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  return {
    userId: user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    isNewUser: !profile,
  };
}

module.exports = { sendOtp, verifyOtp };