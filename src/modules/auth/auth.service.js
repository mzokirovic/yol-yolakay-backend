// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase'); // Bu DB uchun (Admin)

// ✅ MAXSUS AUTH CLIENT (Faqat Auth uchun)
const authUrl = process.env.SUPABASE_URL;
const authKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!authUrl || !authKey) {
    throw new Error("AUTH SERVICE ERROR: .env faylida SUPABASE_ANON_KEY yo'q!");
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

// ✅ SEND OTP (Tuzatilgan: Raqamni majburiy tozalash)
async function sendOtp(phone) {
    if (typeof phone !== 'string') {
        throw new Error("Phone must be a string");
    }

    // 1. RAQAMNI TOZALASH (Sanitization)
    // Barcha probel, tire va qavslarni olib tashlaymiz. Faqat raqam va + qolsin.
    let cleanPhone = phone.replace(/[^\d+]/g, '');

    // 2. FORMATLASH
    // Agar + belgisi tushib qolgan bo'lsa, qo'shamiz
    if (!cleanPhone.startsWith('+')) {
        cleanPhone = `+${cleanPhone}`;
    }

    console.log(`🚀 Sending OTP via AuthClient to: '${cleanPhone}' (Original: '${phone}')`);

    // 3. YUBORISH
    const { data, error } = await authClient.auth.signInWithOtp({
        phone: cleanPhone,
    });

    if (error) {
        console.error("🔥 Supabase Auth Error:", error);
        throw error;
    }
    return data;
}

// ✅ VERIFY OTP
async function verifyOtp(req) {
  const body = req.body || {};

  // Raqamni bu yerda ham tozalaymiz
  let phone = body.phone;
  if (phone) {
      phone = phone.replace(/[^\d+]/g, '');
      if (!phone.startsWith('+')) phone = `+${phone}`;
  }

  const code = body.code || body.token;

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

  // 2. Profilni tekshirish
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