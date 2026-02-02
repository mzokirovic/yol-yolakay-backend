const express = require('express');
const router = express.Router();
const controller = require('./profile.controller');

router.get('/me', controller.getMe);
router.put('/me', controller.updateMe);

router.get('/me/vehicle', controller.getMyVehicle);
router.put('/me/vehicle', controller.upsertMyVehicle);

module.exports = router;
