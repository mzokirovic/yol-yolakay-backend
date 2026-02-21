const supabase = require('./db/supabase');

function extractToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

function maskToken(t) {
  if (!t) return "null";
  const dots = (t.match(/\./g) || []).length;
  return `${t.slice(0, 6)}...${t.slice(-4)} len=${t.length} dots=${dots}`;
}

module.exports = async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({
                  success: false,
                  error: { message: "AUTH_REQUIRED" },
                  message: "AUTH_REQUIRED"
                });

    // ✅ DEBUG: token formatini ko‘ramiz (JWT bo‘lsa dots=2 chiqadi)
    if ((process.env.DEBUG_AUTH || '').toLowerCase() === 'true') {
      console.log("🔐 requireAuth token:", maskToken(token));
    }

    const { data, error } = await supabase.auth.getUser(token);

    // ✅ DEBUG: error message
    if ((process.env.DEBUG_AUTH || '').toLowerCase() === 'true' && error) {
      console.log("❌ requireAuth error:", error.message);
    }

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        error: { message: "INVALID_TOKEN" },
        message: "INVALID_TOKEN"
      });
    }


    if ((process.env.DEBUG_AUTH || '').toLowerCase() === 'true') {
      console.log("✅ requireAuth user.id:", data.user.id);
    }


    req.user = data.user;
    next();
  } catch (e) {
    next(e);
  }
};
