const router = require('express').Router();
const controller = require('./profile.controller');
const requireAuth = require('../../core/requireAuth');

// ✅ Public reference
router.get('/cars', controller.getCarReference);

// ✅ Qolgan hammasi private
router.use(requireAuth);

router.get('/me', controller.getMe);
router.put('/me', controller.updateMe);

router.get('/me/vehicle', controller.getMyVehicle);
router.put('/me/vehicle', controller.upsertMyVehicle);

router.post('/vehicle', controller.upsertVehicleDirect);

module.exports = router;
