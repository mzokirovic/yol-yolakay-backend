const router = require('express').Router();
const controller = require('./profile.controller');
const requireAuth = require('../../core/requireAuth');

// ✅ Public reference
router.get('/cars', controller.getCarReference);

// ✅ Qolgan hammasi private
router.use(requireAuth);

router.get('/me', controller.getMe);
router.put('/me', controller.updateMe);

// compat single vehicle
router.get('/me/vehicle', controller.getMyVehicle);
router.put('/me/vehicle', controller.upsertMyVehicle);
router.delete('/me/vehicle', controller.deleteMyVehicle);

// legacy (qoldiramiz)
router.post('/vehicle', controller.upsertVehicleDirect);

// ✅ NEW: multi vehicles
router.get('/me/vehicles', controller.listMyVehicles);
router.post('/me/vehicles', controller.addMyVehicle);
router.put('/me/vehicles/:id', controller.updateMyVehicleById);
router.delete('/me/vehicles/:id', controller.deleteMyVehicleById);
router.post('/me/vehicles/:id/primary', controller.setMyVehiclePrimary);

module.exports = router;