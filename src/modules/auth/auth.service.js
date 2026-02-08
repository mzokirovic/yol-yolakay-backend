// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

const AUTH_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(AUTH_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Test raqamlari va kodlarini shu yerda markazlashtiramiz
const TEST_ACCOUNTS = {
    '+998975387877': '777777',
    '+998500127129': '000000',
    '+19999999999': '111111'
};

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

/** ✅ SEND OTP */
async function sendOtp(phoneInput) {
    let phone = phoneInput.replace(/[^\d]/g, '');
    const finalPhone = `+${phone}`;
    console.log(`📡 OTP so'rovi: ${finalPhone}`);

    // Avval foydalanuvchini admin sifatida yaratishga yoki topishga urinamiz
    // Bu foydalanuvchini Supabase Users ro'yxatida paydo bo'lishini ta'minlaydi
    await supabaseAdmin.auth.admin.createUser({
        phone: finalPhone,
        phone_confirm: true // SMS tasdiqlashni kutmasdan tasdiqlaymiz
    }).catch(() => console.log("User allaqachon mavjud"));

    const { error } = await supabaseAdmin.auth.signInWithOtp({ phone: finalPhone });

    if (error) {
        const isProviderError = error.message.toLowerCase().includes('provider') ||
                                error.message.toLowerCase().includes('twilio');
        if (isProviderError || TEST_ACCOUNTS[finalPhone]) {
            console.warn(`⚠️ SMS Bypass faol: ${finalPhone}`);
            return { success: true, message: "OTP sent (Bypass)" };
        }
        throw error;
    }
    return { success: true, message: "OTP sent" };
}

/** ✅ VERIFY OTP */
async function verifyOtp(req) {
  const { phone: phoneInput, code } = req.body;
  let phone = phoneInput.replace(/[^\d]/g, '');
  const finalPhone = `+${phone}`;
  const inputCode = code.toString().trim();

  console.log(`🔍 Tekshiruv: ${finalPhone} | Kod: ${inputCode}`);

  // 1. TEST REJIMINI TEKSHIRISH (Dashboard-ga bog'lanmagan bo'lsa ham ishlaydi)
  if (TEST_ACCOUNTS[finalPhone] === inputCode) {
      console.log("✅ TEST MODE: Kirishga ruxsat berildi");

      // Admin huquqi bilan foydalanuvchi ma'lumotlarini olamiz
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      let user = users.find(u => u.phone === finalPhone);

      // Agar user topilmasa, yaratamiz
      if (!user) {
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
              phone: finalPhone,
              phone_confirm: true
          });
          if (createError) throw createError;
          user = newUser.user;
      }

      // Foydalanuvchi uchun yangi sessiya (token) yaratamiz
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink', // yoki 'signup'
          email: user.email, // telefon bo'lsa telefon ishlatiladi
          phone: finalPhone
      });

      // SODDALASHTIRILGAN JAVOB: Test uchun foydalanuvchi ID sini qaytaramiz
      const { data: profile } = await dbClient.from('profiles').select('user_id').eq('user_id', user.id).single();

      return {
          userId: user.id,
          accessToken: "test_token_" + Math.random().toString(36).substr(2),
          refreshToken: "test_refresh",
          isNewUser: !profile,
      };
  }

  // 2. NORMAL REJIM (Haqiqiy SMS kelsa)
  const { data, error } = await supabaseAdmin.auth.verifyOtp({ phone: finalPhone, token: inputCode, type: 'sms' });
  if (error) throw badRequest(`Xato: ${error.message}`);

  const { data: profile } = await dbClient.from('profiles').select('user_id').eq('user_id', data.user.id).single();

  return {
    userId: data.user.id,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    isNewUser: !profile,
  };
}

module.exports = { sendOtp, verifyOtp };