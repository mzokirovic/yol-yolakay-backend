// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

// 1. O'zgaruvchilarni qattiq tekshiramiz
const AUTH_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!AUTH_URL || !SERVICE_KEY) {
    console.error("❌ XATO: .env faylida yoki Render Environmentda kalitlar yo'q!");
    console.error("Tekshiring: SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY");
    throw new Error("Server konfiguratsiya xatosi");
}

// 2. Admin Client yaratamiz (Eng ishonchli usul)
// Bu client har qanday operatsiyani bajara oladi, lekin biz uni to'g'ri ishlatamiz.
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
 * Haqiqiy ilova logikasi:
 * - Raqamni oladi.
 * - Supabasega "SMS yubor" deb buyruq beradi.
 * - Agar bu Test Raqam bo'lsa, Supabase SMS yubormaydi, lekin "Success" deydi.
 * - Agar bu Haqiqiy raqam bo'lsa (va Twilio ulangan bo'lsa), SMS ketadi.
 */
async function sendOtp(phoneInput) {
    if (typeof phoneInput !== 'string') throw badRequest("Telefon raqam string bo'lishi kerak");

    // Formatlash: Har doim E.164 standarti (+998...)
    let phone = phoneInput.replace(/[^\d]/g, '');
    const finalPhone = `+${phone}`;

    console.log(`📡 OTP so'rovi: ${finalPhone}`);

    // Standard Supabase funksiyasi
    const { data, error } = await supabaseAdmin.auth.signInWithOtp({
        phone: finalPhone,
    });

    if (error) {
        console.error("🔥 Supabase OTP Error:", error.message);
        // Agar Twilio ulanmagan bo'lsa va bu oddiy raqam bo'lsa, xato berishi tabiiy.
        // Lekin Test Raqam (19999999999) uchun xato bermasligi kerak.
        throw error;
    }

    console.log("✅ OTP yuborildi (yoki Test Raqam qabul qilindi).");
    return { success: true, message: "OTP sent" };
}

/**
 * ✅ VERIFY OTP
 * Haqiqiy ilova logikasi:
 * - Raqam va Kodni oladi.
 * - Supabasega "Shu kod to'g'rimi?" deb so'raydi.
 * - Agar to'g'ri bo'lsa, User va Session qaytaradi.
 */
async function verifyOtp(req) {
  const body = req.body || {};
  let phoneInput = body.phone || "";
  const code = body.code || body.token;

  if (!phoneInput) throw badRequest("Telefon raqam kiritilmadi");
  if (!code) throw badRequest("Kod kiritilmadi");

  // Formatlash
  let phone = phoneInput.replace(/[^\d]/g, '');
  const finalPhone = `+${phone}`;

  console.log(`🔍 Kod tekshirilyapti: ${finalPhone} | Kod: ${code}`);

  // Admin Client orqali tekshiramiz (Bu eng ishonchli yo'l)
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

  // Profilni tekshirish (Real DB logikasi)
  // User ro'yxatdan o'tganmi yoki yangimi?
  const { data: profile } = await dbClient
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  return {
    userId: user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    isNewUser: !profile, // Agar profil bo'lmasa, demak yangi user
  };
}

module.exports = { sendOtp, verifyOtp };