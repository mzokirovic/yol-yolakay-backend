const supabase = require('./db/supabase');

function extractToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

module.exports = async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, error: "AUTH_REQUIRED" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ success: false, error: "INVALID_TOKEN" });

    req.user = data.user;
    next();
  } catch (e) {
    next(e);
  }
}
