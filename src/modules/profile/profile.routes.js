// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/profile/profile.routes.js

const router = require('express').Router();
const controller = require('./profile.controller');
// Agar sizda auth middleware bo'lsa, uni shu yerda chaqiring.
// Hozircha "User ID headerdan olinadi" deb kelishdik, shuning uchun optional bo'lishi mumkin.
// Lekin odatda: const auth = require('../../core/requireAuth');

// 1. Profilni olish va yangilash
router.get('/me', controller.getMe);
router.put('/me', controller.updateMe);

// 2. Mashina ma'lumotlari
router.get('/me/vehicle', controller.getMyVehicle);
router.put('/me/vehicle', controller.upsertMyVehicle); // Eski (PUT)

// 3. ✅ YANGI: Mashina referencelari (Brendlar)
// Agar controllerda getCarReference funksiyasi yo'q bo'lsa yoki nomi boshqacha bo'lsa, shu yerda xato beradi.
router.get('/cars', controller.getCarReference);

// 4. ✅ YANGI: Mashina saqlash (POST) - Logdagi xato shu yerda bo'lishi mumkin
// Controllerda "upsertVehicleDirect" deb nomlagan edik.
router.post('/vehicle', controller.upsertVehicleDirect);

module.exports = router;