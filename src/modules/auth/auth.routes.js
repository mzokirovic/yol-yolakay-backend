const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');

router.post('/otp/send', controller.sendOtp);
router.post('/otp/verify', controller.verifyOtp);

module.exports = router;
