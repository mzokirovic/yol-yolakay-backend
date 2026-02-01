const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');

// POST: E'lon berish
router.post('/publish', tripController.publishTrip);
// GET: Qidirish (YANGI)
// Manzil: /api/trips/search
router.get('/search', tripController.searchTrips);
router.get('/my', tripController.getMyTrips);

module.exports = router;