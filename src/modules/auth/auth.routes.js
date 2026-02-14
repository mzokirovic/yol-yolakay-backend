const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');

router.post('/otp/send', controller.sendOtp);
router.post('/otp/verify', controller.verifyOtp);
router.post('/refresh', controller.refresh);

module.exports = router;
