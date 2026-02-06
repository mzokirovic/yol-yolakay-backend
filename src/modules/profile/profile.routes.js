const express = require('express');
const router = express.Router();
const controller = require('./profile.controller');

const optionalAuth = require('../../core/optionalAuth');
router.use(optionalAuth);

// Profil
router.get('/me', controller.getMe);
router.put('/me', controller.updateMe);

// Mashina (Eski usul)
router.get('/me/vehicle', controller.getMyVehicle);
router.put('/me/vehicle', controller.upsertMyVehicle);

// ✅ YANGI ROUTELAR (Mashina Reference va Saqlash)
router.get('/cars', controller.getCarReference); // Brendlar ro'yxatini olish
router.post('/vehicle', controller.upsertVehicleDirect); // Yangi saqlash metodi

module.exports = router;