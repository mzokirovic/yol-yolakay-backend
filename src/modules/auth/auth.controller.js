const service = require('./auth.service');

async function sendOtp(req, res, next) {
  try {
    // 1. Bodydan telefonni ajratib olamiz
    const { phone } = req.body;

    // 2. Validatsiya (Servicega kirmasdan oldin)
    if (!phone) {
      const err = new Error("Phone number is required");
      err.statusCode = 400;
      throw err;
    }

    // 3. Servicega faqat kerakli stringni beramiz
    await service.sendOtp(phone);

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

async function verifyOtp(req, res, next) {
  try {
    // Controller "req" ni servicega tiqishtirmasligi kerak, lekin
    // sizning serviceingiz "req" kutayotgan ekan, hozircha tegmaymiz.
    // Lekin sendOtp to'g'irlandi.
    const data = await service.verifyOtp(req);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

module.exports = { sendOtp, verifyOtp };