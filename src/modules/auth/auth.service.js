// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

// 1. SIZNING ANIQ URLINGIZ (O'ZINGIZ TASDIQLADINGIZ)
const AUTH_URL = "https://xfmptfmxiyssbejwdmgz.supabase.co";

// 2. SIZNING KALITINGIZ (ENV dagi SUPABASE_ANON_KEY ni to'liq nusxalab qo'ying)
// Oxiridagi yulduzchalar o'rniga haqiqiy harflarni yozing!
const AUTH_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbXB0Zm14aXlzc2JlandkbWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzODc2NzksImV4cCI6MjA4Mzk2MzY3OX0.vHLfRA8gnhBDaaOwW_3uyLrttqbeqBz5oKQfuUMN****";

console.log("🛠️ BACKEND ISHLATAYOTGAN URL:", AUTH_URL);

if (AUTH_KEY.includes("****")) {
    console.error("❌ DIQQAT: Siz AUTH_KEY ni to'liq yozmadingiz! Kod ichini to'g'rilang.");
}

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

// ✅ SEND OTP (DIAGNOSTIKA)
async function sendOtp(phoneInput) {
    // Ilovadan nima kelishidan qat'iy nazar...

    // Biz Supabasega "E.164" formatida (+1...) yuborishimiz SHART.
    // Dashboardda "1555..." yozilgan bo'lsa ham, API "+" talab qiladi.
    const TEST_PHONE = "+15551234567";

    console.log(`🧪 TEST REJIMI: Biz Supabasega majburlab '${TEST_PHONE}' yuboryapmiz.`);
    console.log(`🎯 Maqsad: '${AUTH_URL}' dagi Test Numbers ro'yxati.`);

    const { data, error } = await authClient.auth.signInWithOtp({
        phone: TEST_PHONE,
    });

    if (error) {
        console.error("🔥 Supabase XATOSI:", error.message);
        console.error("💡 SABAB: Supabase bu raqamni Test Ro'yxatdan topa olmadi va Twilio ishlatishga urindi.");
        throw error;
    }

    console.log("✅ SUCCESS! 200 OK. Supabase Test Nomerni tanidi!");
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

  if (!user || !session) throw badRequest("Verification failed");

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