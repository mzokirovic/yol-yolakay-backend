// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

// 1. SIZNING PROYEKT URL (To'g'ri)
const AUTH_URL = "https://xfmptfmxiyssbejwdmgz.supabase.co";

// 2. SIZ YUBORGAN KALIT (To'g'ri joylandi)
const AUTH_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbXB0Zm14aXlzc2JlandkbWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzODc2NzksImV4cCI6MjA4Mzk2MzY3OX0.vHLfRA8gnhBDaaOwW_3uyLrttqbeqBz5oKQfuUMNcFo";

console.log("🛠️ BACKEND ISHLATAYOTGAN URL:", AUTH_URL);

// Client yaratamiz
const authClient = createClient(AUTH_URL, AUTH_KEY, {
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

// ✅ SEND OTP (DIAGNOSTIKA MODE)
async function sendOtp(phoneInput) {
    // Biz hozircha har doim TEST raqamni ishlatamiz.
    // Ilovadan nima kelishidan qat'iy nazar.
    // MAQSAD: 500 xatosini yo'qotish va tizim ishlashini ko'rish.

    // Supabase Dashboard -> Test Numbers ro'yxatida "15551234567" bo'lishi SHART!
    const TEST_PHONE = "+15551234567";

    console.log(`🧪 TEST REJIMI: Ilovadan '${phoneInput}' keldi, lekin biz '${TEST_PHONE}' yuboryapmiz.`);

    const { data, error } = await authClient.auth.signInWithOtp({
        phone: TEST_PHONE,
    });

    if (error) {
        console.error("🔥 Supabase XATOSI:", error.message);
        throw error;
    }

    console.log("✅ SUCCESS! 200 OK - SMS yuborilmadi (Test).");
    return data;
}

// ✅ VERIFY OTP
async function verifyOtp(req) {
  const body = req.body || {};
  const code = body.code || body.token;

  // Verify paytida ham o'sha test raqam
  const TEST_PHONE = "+15551234567";

  if (!code) throw badRequest("code is required");

  console.log(`🔍 Verify: '${TEST_PHONE}' code: '${code}'`);

  const { data, error } = await authClient.auth.verifyOtp({
    phone: TEST_PHONE,
    token: code,
    type: 'sms',
  });

  if (error) throw error;

  const user = data.user;
  const session = data.session;

  if (!user || !session) throw badRequest("Auth verification failed");

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