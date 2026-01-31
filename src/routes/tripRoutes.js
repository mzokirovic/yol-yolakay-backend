const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');

// POST: /api/trips/publish
router.post('/publish', tripController.publishTrip);

module.exports = router;