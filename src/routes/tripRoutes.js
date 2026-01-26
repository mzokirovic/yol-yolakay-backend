const express = require('express');
const router = express.Router();
const TripController = require('../controllers/tripController');// Safarlar ro'yxati
router.get('/', TripController.getAll);

router.get('/:id', TripController.getById);
router.get('/:id', tripController.getById);
router.post('/', TripController.createTrip);
router.post('/:id/book-seat', TripController.bookSeat);
router.post('/:id/cancel-seat', TripController.cancelSeat);
router.get('/my/driver', TripController.getMyDriverTrips);
router.get('/my/bookings', TripController.getMyBookings);

module.exports = router;
