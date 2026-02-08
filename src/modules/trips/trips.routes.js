// src/modules/trips/trips.routes.js
const express = require('express');
const router = express.Router();
const controller = require('./trips.controller');
const requireAuth = require('../../core/requireAuth');

// Public
router.post('/calculate-price', controller.calculatePricePreview);
router.get('/search', controller.searchTrips);
router.get('/points', controller.getPopularPoints);
router.get('/:id', controller.getTripDetails);

// Auth required
router.post('/publish', requireAuth, controller.publishTrip);
router.get('/my', requireAuth, controller.getMyTrips);

// Seat actions (auth)
router.post('/:id/seats/:seatNo/block', requireAuth, controller.blockSeat);
router.post('/:id/seats/:seatNo/unblock', requireAuth, controller.unblockSeat);

router.post('/:id/seats/:seatNo/request', requireAuth, controller.requestSeat);
router.post('/:id/seats/:seatNo/cancel', requireAuth, controller.cancelRequest);
router.post('/:id/seats/:seatNo/approve', requireAuth, controller.approveSeat);
router.post('/:id/seats/:seatNo/reject', requireAuth, controller.rejectSeat);

module.exports = router;
