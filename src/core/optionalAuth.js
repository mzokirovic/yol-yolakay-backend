const supabase = require('./db/supabase');

function extractToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

module.exports = async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next(); // token yo'q => guest/fallback

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ success: false, error: 'INVALID_TOKEN' });
    }

    req.user = data.user;
    next();
  } catch (e) {
    next(e);
  }
};
