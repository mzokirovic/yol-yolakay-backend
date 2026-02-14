require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dbClient = require('../../core/db/supabase');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// test | prod
const OTP_MODE = (process.env.OTP_MODE || 'prod').toLowerCase();

// TEST_PHONES=998500127129,998975387877,...
const TEST_PHONES = (process.env.TEST_PHONES || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const DEBUG_AUTH = (process.env.DEBUG_AUTH || 'false').toLowerCase() === 'true';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Bu xato bo'lsa deploy/env muammosi – logda ko‘rinsin
  console.error("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY env");
}

// ✅ OTP flow uchun publishable/anon client (to‘g‘ri amaliyot)
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

function digitsOnly(phoneInput) {
  return phoneInput.toString().replace(/[^\d]/g, '');
}

// Log uchun raqamni mask qilish (xavfsiz)
function maskPhoneDigits(d) {
  if (!d) return "***";
  if (d.length <= 4) return "***";
  return `${d.slice(0, 3)}***${d.slice(-2)}`; // 998***29
}

// Supabase’ga yuboriladigan format:
// - TEST: digits-only (dashboard test mapping '+'siz bo‘lgani uchun)
// - PROD: E.164 (+digits)
function phoneForSupabase(phoneInput) {
  const digits = digitsOnly(phoneInput);
  if (OTP_MODE === 'test') return digits;
  return `+${digits}`;
}

// TEST rejimda faqat ruxsat etilgan raqamlar
function ensureAllowedInTest(digits) {
  if (OTP_MODE !== 'test') return;
  if (!TEST_PHONES.includes(digits)) {
    throw badRequest("TEST rejim: faqat Supabase Dashboard’dagi test raqamlar ruxsat.");
  }
}

// Minimal validatsiya (domino bo‘lmasin deb juda qattiq qilmaymiz)
function ensurePhoneLooksValid(digits) {
  if (!digits || digits.length < 9) {
    throw badRequest("Telefon raqam noto‘g‘ri");
  }
}

async function sendOtp(phoneInput) {
  if (!phoneInput) throw badRequest("Telefon raqam kiritilmadi");

  const digits = digitsOnly(phoneInput);
  ensurePhoneLooksValid(digits);
  ensureAllowedInTest(digits);

  const phone = phoneForSupabase(phoneInput);

  if (DEBUG_AUTH) {
    console.log(`📡 sendOtp: mode=${OTP_MODE} phone=${maskPhoneDigits(digits)}`);
  }

  const { error } = await supabaseAuth.auth.signInWithOtp({ phone });
  if (error) throw badRequest(`OTP yuborilmadi: ${error.message}`);

  return { success: true };
}

async function verifyOtp(req) {
  const body = req.body || {};

  const phoneInput = body.phone || body.phoneNumber || "";
  // Android yuborishi mumkin: token/code/otp
  const rawCode = body.code || body.token || body.otp || "";

  if (!phoneInput) throw badRequest("Telefon raqam kiritilmadi");
  if (!rawCode) throw badRequest("Kod kiritilmadi");

  const digits = digitsOnly(phoneInput);
  ensurePhoneLooksValid(digits);
  ensureAllowedInTest(digits);

  const phone = phoneForSupabase(phoneInput);
  const token = rawCode.toString().trim();

  // 🔒 token/otp log qilinmaydi
  if (DEBUG_AUTH) {
    console.log(`🔍 verifyOtp: mode=${OTP_MODE} phone=${maskPhoneDigits(digits)}`);
  }

  const { data, error } = await supabaseAuth.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });

  if (error) throw badRequest(`Tasdiqlash xatosi: ${error.message}`);
  if (!data?.user || !data?.session) throw badRequest("Session topilmadi");

  // profile bor-yo‘qligini bilish uchun
  const { data: profile } = await dbClient
    .from('profiles')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();

  // ✅ Android kutayotgan snake_case contract – O'ZGARMAYDI
  return {
    success: true,
    user_id: data.user.id,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    is_new_user: !profile,
  };
}


async function refresh(req) {
  const body = req.body || {};
  const refreshToken = body.refresh_token || body.refreshToken || "";

  if (!refreshToken) throw badRequest("refresh_token required");

  const { data, error } = await supabaseAuth.auth.refreshSession({
    refresh_token: refreshToken
  });

  if (error) throw badRequest(`Refresh xatosi: ${error.message}`);
  if (!data?.session || !data?.user) throw badRequest("Session topilmadi");

  return {
    success: true,
    user_id: data.user.id,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    is_new_user: false
  };
}

module.exports = { sendOtp, verifyOtp, refresh };

