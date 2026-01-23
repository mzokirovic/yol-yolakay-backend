const express = require('express');
const router = express.Router();
const TripController = require('../controllers/tripController');

router.get('/', TripController.getAll);
router.post('/:id/book-seat', TripController.bookSeat);

module.exports = router;

