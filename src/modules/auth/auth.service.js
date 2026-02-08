// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

// 1. URL (Sizniki)
const AUTH_URL = "https://xfmptfmxiyssbejwdmgz.supabase.co";

// 2. KALIT (DIQQAT: .trim() funksiyasi qo'shildi)
// Bu har qanday bo'sh joyni (probelni) olib tashlaydi.
const RAW_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbXB0Zm14aXlzc2JlandkbWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzODc2NzksImV4cCI6MjA4Mzk2MzY3OX0.vHLfRA8gnhBDaaOwW_3uyLrttqbeqBz5oKQfuUMNcFo";
const AUTH_KEY = RAW_KEY.trim();

console.log("🛠️ BACKEND URL:", AUTH_URL);

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

// ✅ SEND OTP
async function sendOtp(phoneInput) {
    // 🔴 YANGI TEST RAQAM (PLYUS BILAN)
    // Dashboardda "19999999999" (plyussiz) -> Bu yerda "+19999999999"
    const TEST_PHONE = "+19999999999";

    console.log(`🧪 TEST REJIMI: '${TEST_PHONE}' raqamiga so'rov ketdi...`);

    const { data, error } = await authClient.auth.signInWithOtp({
        phone: TEST_PHONE,
    });

    if (error) {
        console.error("🔥 Supabase XATOSI:", error.message);
        throw error;
    }

    console.log("✅ SUCCESS! 200 OK. Twilio ishlatilmadi.");
    return data;
}

// ✅ VERIFY OTP
async function verifyOtp(req) {
  const body = req.body || {};
  const code = body.code || body.token;

  // Verify paytida ham o'sha YANGI test raqam
  const TEST_PHONE = "+19999999999";

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