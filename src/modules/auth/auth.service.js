require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const OTP_MODE = (process.env.OTP_MODE || 'prod').toLowerCase();
const TEST_PHONES = (process.env.TEST_PHONES || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ✅ OTP flow uchun ANON client ishlatamiz (to‘g‘ri amaliyot)
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

function digitsOnly(phoneInput) {
  return phoneInput.toString().replace(/[^\d]/g, '');
}

function phoneForSupabase(phoneInput) {
  const digits = digitsOnly(phoneInput);

  // ✅ TEST mapping Dashboard’da '+'siz, shuning uchun testda digits yuboramiz
  if (OTP_MODE === 'test') return digits;

  // ✅ Prod: E.164
  return `+${digits}`;
}

function ensureAllowedInTest(digits) {
  if (OTP_MODE !== 'test') return;
  if (!TEST_PHONES.includes(digits)) {
    throw badRequest("TEST rejim: faqat Supabase Dashboard’dagi test raqamlar ruxsat.");
  }
}

async function sendOtp(phoneInput) {
  if (!phoneInput) throw badRequest("Telefon raqam kiritilmadi");

  const digits = digitsOnly(phoneInput);
  ensureAllowedInTest(digits);

  const phone = phoneForSupabase(phoneInput);
  console.log(`📡 sendOtp: mode=${OTP_MODE} phone=${phone} digits=${digits}`);

  const { error } = await supabaseAuth.auth.signInWithOtp({ phone });
  if (error) throw badRequest(`OTP yuborilmadi: ${error.message}`);

  return { success: true };
}

async function verifyOtp(req) {
  const body = req.body || {};
  const phoneInput = body.phone || body.phoneNumber || "";
  const rawCode = body.code || body.token || body.otp || "";

  if (!phoneInput) throw badRequest("Telefon raqam kiritilmadi");
  if (!rawCode) throw badRequest("Kod kiritilmadi");

  const digits = digitsOnly(phoneInput);
  ensureAllowedInTest(digits);

  const phone = phoneForSupabase(phoneInput);
  const token = rawCode.toString().trim();

  console.log(`🔍 verifyOtp: mode=${OTP_MODE} phone=${phone} digits=${digits} token=${token}`);

  const { data, error } = await supabaseAuth.auth.verifyOtp({
    phone,
    token,
    type: 'sms'
  });

  if (error) throw badRequest(`Tasdiqlash xatosi: ${error.message}`);
  if (!data?.user || !data?.session) throw badRequest("Session topilmadi");

  const { data: profile } = await dbClient
    .from('profiles')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();

  // ✅ Android kutayotgan snake_case contract
  return {
    success: true,
    user_id: data.user.id,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    is_new_user: !profile
  };
}

module.exports = { sendOtp, verifyOtp };
