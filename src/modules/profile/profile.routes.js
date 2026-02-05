const express = require('express');
const router = express.Router();
const controller = require('./profile.controller');

const optionalAuth = require('../../core/optionalAuth');
router.use(optionalAuth); // ✅ faqat qo'shildi, qolganiga tegmadik

router.get('/me', controller.getMe);
router.put('/me', controller.updateMe);

router.get('/me/vehicle', controller.getMyVehicle);
router.put('/me/vehicle', controller.upsertMyVehicle);

module.exports = router;
