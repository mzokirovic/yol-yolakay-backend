// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

const authUrl = process.env.SUPABASE_URL;
const authKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!authUrl || !authKey) throw new Error("AUTH SERVICE ERROR: Key not found");

const authClient = createClient(authUrl, authKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

// ✅ SEND OTP (Real User yaratish uchun)
async function sendOtp(phone) {
    if (typeof phone !== 'string') throw new Error("Phone must be a string");

    // 1. TOZALASH: Har qanday belgini (probel, tire, plyus) olib tashlaymiz
    // Masalan: "1 (555) 123-4567" -> "15551234567"
    let cleanPhone = phone.replace(/[^\d]/g, '');

    // 2. FORMATLASH: Majburan boshiga + qo'shamiz
    // Natija: "+15551234567" (Bu Supabase kutayotgan format)
    const finalPhone = `+${cleanPhone}`;

    console.log(`🚀 Supabasega yuborilyapti: '${finalPhone}'`);

    // 3. SO'ROV YUBORISH
    // Supabase bu raqamni "Test Numbers" dan topsa, Twilio ishlatmaydi.
    // Lekin Userni "auth.users" jadvaliga qo'shadi (agar yo'q bo'lsa).
    const { data, error } = await authClient.auth.signInWithOtp({
        phone: finalPhone,
    });

    if (error) {
        console.error("🔥 XATO:", error.message);
        throw error;
    }

    console.log("✅ OK! SMS simulyatsiya qilindi.");
    return data;
}

// ✅ VERIFY OTP
async function verifyOtp(req) {
  const body = req.body || {};
  let phone = body.phone;
  const code = body.code || body.token;

  if (phone) {
      // Verify paytida ham plyuslash kerak
      const clean = phone.replace(/[^\d]/g, '');
      phone = `+${clean}`;
  }

  if (!phone) throw badRequest("phone is required");
  if (!code) throw badRequest("code is required");

  console.log(`🔍 Verify: '${phone}' code: '${code}'`);

  const { data, error } = await authClient.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });

  if (error) throw error;

  const user = data.user;
  const session = data.session;

  if (!user || !session) throw badRequest("Verification failed");

  // Profilni tekshirish yoki yaratish
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