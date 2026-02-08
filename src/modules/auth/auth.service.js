// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

// 1. O'zgaruvchilarni tekshiramiz
const AUTH_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!AUTH_URL || !SERVICE_KEY) {
    console.error("❌ XATO: .env faylida yoki Render Environmentda kalitlar yo'q!");
    throw new Error("Server konfiguratsiya xatosi");
}

// 2. Admin Client yaratamiz
const supabaseAdmin = createClient(AUTH_URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

/**
 * ✅ SEND OTP
 * Professional yechim: Test raqamlari uchun provayder (Twilio) xatolarini chetlab o'tadi.
 */
async function sendOtp(phoneInput) {
    if (typeof phoneInput !== 'string') throw badRequest("Telefon raqam string bo'lishi kerak");

    let phone = phoneInput.replace(/[^\d]/g, '');
    const finalPhone = `+${phone}`;

    console.log(`📡 OTP so'rovi: ${finalPhone}`);

    // Supabase orqali OTP yuborishga urinish
    const { data, error } = await supabaseAdmin.auth.signInWithOtp({
        phone: finalPhone,
    });

    if (error) {
        // 🛡️ Test raqamlari uchun Twilio xatosini bypass qilamiz
        const isTestPhone = finalPhone === '+998975387877' || finalPhone === '+19999999999';
        const isProviderError = error.message.toLowerCase().includes('provider') ||
                                error.message.toLowerCase().includes('twilio');

        if (isTestPhone && isProviderError) {
            console.warn("⚠️ SMS provayder xatosi test raqami uchun e'tiborsiz qoldirildi.");
            return { success: true, message: "OTP sent (Test Mode)" };
        }

        console.error("🔥 Supabase OTP Error:", error.message);
        throw error;
    }

    console.log("✅ OTP yuborildi.");
    return { success: true, message: "OTP sent" };
}

/**
 * ✅ VERIFY OTP
 */
async function verifyOtp(req) {
  const body = req.body || {};
  let phoneInput = body.phone || "";
  const code = body.code || body.token;

  if (!phoneInput) throw badRequest("Telefon raqam kiritilmadi");
  if (!code) throw badRequest("Kod kiritilmadi");

  let phone = phoneInput.replace(/[^\d]/g, '');
  const finalPhone = `+${phone}`;

  console.log(`🔍 Kod tekshirilyapti: ${finalPhone} | Kod: ${code}`);

  const { data, error } = await supabaseAdmin.auth.verifyOtp({
    phone: finalPhone,
    token: code,
    type: 'sms',
  });

  if (error) {
      console.error("Verify Error:", error.message);
      throw badRequest("Kod noto'g'ri yoki eskirgan");
  }

  const user = data.user;
  const session = data.session;

  if (!user || !session) throw badRequest("Tizim xatosi: Session yaratilmadi");

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

// 🚀 MUHIM: Funksiyalarni eksport qilish
module.exports = {
    sendOtp,
    verifyOtp
};