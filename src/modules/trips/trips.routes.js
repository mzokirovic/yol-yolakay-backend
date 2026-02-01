const express = require('express');
const router = express.Router();
const controller = require('./trips.controller');

router.post('/publish', controller.publishTrip);
router.get('/search', controller.searchTrips);
router.get('/my', controller.getMyTrips);

module.exports = router;
