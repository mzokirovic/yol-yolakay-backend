const express = require('express');
const router = express.Router();
const controller = require('./trips.controller');

router.post('/publish', controller.publishTrip);
router.get('/search', controller.searchTrips);
router.get('/my', controller.getMyTrips);

router.get('/:id', controller.getTripDetails);

// Seat actions
router.post('/:id/seats/:seatNo/block', controller.blockSeat);
router.post('/:id/seats/:seatNo/unblock', controller.unblockSeat);

// ✅ MVP+ flow
router.post('/:id/seats/:seatNo/request', controller.requestSeat);  // passenger
router.post('/:id/seats/:seatNo/cancel', controller.cancelRequest); // passenger
router.post('/:id/seats/:seatNo/approve', controller.approveSeat);  // driver
router.post('/:id/seats/:seatNo/reject', controller.rejectSeat);    // driver

// (old endpoint qolsa ham bo'ladi, hozir ishlatmaymiz)
// router.post('/:id/seats/:seatNo/book', controller.bookSeat);

module.exports = router;
