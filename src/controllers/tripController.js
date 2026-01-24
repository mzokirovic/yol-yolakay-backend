const TripService = require('../services/tripService');

exports.getAll = async (req, res) => {
    try {
        const { from, to, date, passengers } = req.query;
        const data = await TripService.fetchAllTrips(from, to, date, passengers);
        res.status(200).json(data); // Mapper qo'shish mumkin
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.bookSeat = async (req, res) => {
    try {
        const result = await TripService.bookSeat(req.params.id, req.body);
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.createTrip = async (req, res) => {
    try {
        const result = await TripService.createTrip(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
