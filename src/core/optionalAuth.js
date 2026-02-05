const supabase = require('./db/supabase');

module.exports = async function optionalAuth(req, res, next) {
  try {
    const h = req.header('authorization') || '';
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (!m) return next();

    const token = m[1];
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      req.user = { id: data.user.id, phone: data.user.phone, email: data.user.email };
    }
  } catch (_) {
    // ignore
  }
  next();
};
