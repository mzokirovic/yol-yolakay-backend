const service = require('./auth.service');

async function sendOtp(req, res, next) {
  try {
    const { phone } = req.body || {};

    if (!phone) {
      const err = new Error("Phone number is required");
      err.statusCode = 400;
      throw err;
    }

    // ✅ service qaytargan natijani qaytaramiz (domino yo‘q)
    const out = await service.sendOtp(phone);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const data = await service.verifyOtp(req);

    // ✅ Debug log endi controller’da yo‘q (tokenlar chiqmaydi)
    res.json(data);
  } catch (e) {
    next(e);
  }
}

module.exports = { sendOtp, verifyOtp };
