const service = require('./auth.service');

async function sendOtp(req, res, next) {
  try {
    await service.sendOtp(req);
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function verifyOtp(req, res, next) {
  try {
    const data = await service.verifyOtp(req);
    res.json(data); // ✅ AuthResponse kabi object qaytaramiz
  } catch (e) { next(e); }
}

module.exports = { sendOtp, verifyOtp };
