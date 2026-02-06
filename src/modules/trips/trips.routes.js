const express = require('express');
const router = express.Router();
const controller = require('./trips.controller');

router.post('/publish', controller.publishTrip);
router.get('/search', controller.searchTrips);
router.get('/my', controller.getMyTrips);

// ✅ YANGI: Popular Points (ID'li rutdan oldin bo'lishi shart)
router.get('/points', controller.getPopularPoints);

router.get('/:id', controller.getTripDetails);

// Seat actions
router.post('/:id/seats/:seatNo/block', controller.blockSeat);
router.post('/:id/seats/:seatNo/unblock', controller.unblockSeat);

// MVP+ flow
router.post('/:id/seats/:seatNo/request', controller.requestSeat);
router.post('/:id/seats/:seatNo/cancel', controller.cancelRequest);
router.post('/:id/seats/:seatNo/approve', controller.approveSeat);
router.post('/:id/seats/:seatNo/reject', controller.rejectSeat);

module.exports = router;