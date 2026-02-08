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
    const data = await service.verifyOtp(req);

    // ✅ FAQAT DEBUG: tokenlarni yashirib log qilamiz
    console.log("✅ verifyOtp response:", {
      ...data,
      access_token: data.access_token ? "<redacted>" : null,
      refresh_token: data.refresh_token ? "<redacted>" : null,
    });

    res.json(data);
  } catch (e) {
    next(e);
  }
}

module.exports = { sendOtp, verifyOtp };