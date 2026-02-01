const express = require('express');
const router = express.Router();
const controller = require('./trips.controller');

router.post('/publish', controller.publishTrip);
router.get('/search', controller.searchTrips);
router.get('/my', controller.getMyTrips);

router.get('/:id', controller.getTripDetails);
router.post('/:id/seats/:seatNo/book', controller.bookSeat);

module.exports = router;
