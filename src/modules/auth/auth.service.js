const supabase = require('../../core/db/supabase');

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

async function sendOtp(req) {
  const { phone } = req.body || {};
  if (!phone) throw badRequest("phone is required");

  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;

  return true;
}

async function verifyOtp(req) {
  const { phone, code } = req.body || {};
  if (!phone) throw badRequest("phone is required");
  if (!code) throw badRequest("code is required");

  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });
  if (error) throw error;

  const s = data.session;
  return {
    userId: data.user?.id ?? null,
    accessToken: s?.access_token ?? null,
    refreshToken: s?.refresh_token ?? null,
    message: null,
  };
}

module.exports = { sendOtp, verifyOtp };
