const express = require('express');
const router = express.Router();
const TripController = require('../controllers/tripController');// Safarlar ro'yxati
router.get('/', TripController.getAll);

// 🔥 YANGI: Bitta safar tafsiloti (ID bo'yicha)
// Bu GET / bo'limidan keyin turishi kerak
router.get('/:id', TripController.getById);

// Safar yaratish
router.post('/', TripController.createTrip);

// Joy band qilish
router.post('/:id/book-seat', TripController.bookSeat);

// 🔥 YANGI: Joy bandini bekor qilish
router.post('/:id/cancel-seat', TripController.cancelSeat);

module.exports = router;
