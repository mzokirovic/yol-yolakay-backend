// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/auth/auth.service.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

const AUTH_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(AUTH_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

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
    if (!phoneInput) throw badRequest("Telefon raqam kiritilmadi");

    let phone = phoneInput.toString().replace(/[^\d]/g, '');
    const finalPhone = `+${phone}`;
    console.log(`📡 OTP so'rovi: ${finalPhone}`);

    await supabaseAdmin.auth.admin.createUser({
        phone: finalPhone,
        phone_confirm: true
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

/** ✅ VERIFY OTP - Xatosiz variant */
async function verifyOtp(req) {
  const body = req.body || {};

  // Ilovadan kelishi mumkin bo'lgan barcha variantlarni tekshiramiz
  const phoneInput = body.phone || body.phoneNumber || "";
  const rawCode = body.code || body.token || body.otp || "";

  if (!phoneInput) throw badRequest("Telefon raqam kiritilmadi");
  if (!rawCode) throw badRequest("Kod kiritilmadi");

  const inputCode = rawCode.toString().trim();
  const phone = phoneInput.toString().replace(/[^\d]/g, '');
  const finalPhone = `+${phone}`;

  console.log(`🔍 Tekshiruv boshlandi: ${finalPhone} | Kod: ${inputCode}`);

  // 1. TEST REJIMINI TEKSHIRISH
  if (TEST_ACCOUNTS[finalPhone] === inputCode) {
      console.log("✅ TEST MODE: Qo'lda tasdiqlandi!");

      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      let user = users.find(u => u.phone === finalPhone);

      if (!user) {
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
              phone: finalPhone,
              phone_confirm: true
          });
          if (createError) throw createError;
          user = newUser.user;
      }

      const { data: profile } = await dbClient.from('profiles').select('user_id').eq('user_id', user.id).single();

      return {
          userId: user.id,
          accessToken: "test_session_" + Buffer.from(user.id).toString('base64'),
          refreshToken: "test_refresh_token",
          isNewUser: !profile,
      };
  }

  // 2. NORMAL REJIM
  const { data, error } = await supabaseAdmin.auth.verifyOtp({
      phone: finalPhone,
      token: inputCode,
      type: 'sms'
  });

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