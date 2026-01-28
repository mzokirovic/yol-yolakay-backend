const TripService = require('../services/tripService');

function getRequesterId(req) {
  // Kelajakda real auth bo‘lsa shu header’ni token’dan set qilamiz
  return req.header('x-user-id') || null;
}

function sendError(res, err) {
  const status = err.status || 500;
  const msg = err.message || "Server ichki xatosi";
  return res.status(status).json({ error: msg });
}

exports.getAll = async (req, res) => {
  try {
    const { from, to, date, passengers } = req.query;
    const data = await TripService.fetchAllTrips(from, to, date, passengers);
    res.status(200).json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getById = async (req, res) => {
  try {
    const data = await TripService.fetchTripById(req.params.id);
    if (!data) return res.status(404).json({ error: "Safar topilmadi" });
    res.status(200).json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.createTrip = async (req, res) => {
  try {
    const result = await TripService.createTrip(req.body);
    res.status(201).json(result);
  } catch (err) {
    sendError(res, err);
  }
};

exports.bookSeat = async (req, res) => {
  try {
    const requesterId = getRequesterId(req);
    const result = await TripService.bookSeat(req.params.id, req.body, requesterId);
    res.status(200).json(result);
  } catch (err) {
    sendError(res, err);
  }
};

exports.cancelSeat = async (req, res) => {
  try {
    const requesterId = getRequesterId(req);
    const result = await TripService.cancelSeat(req.params.id, req.body, requesterId);
    res.status(200).json(result);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getMyDriverTrips = async (req, res) => {
  try {
    const userId = req.query.userId;
    const data = await TripService.fetchMyDriverTrips(userId);
    res.status(200).json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const userId = req.query.userId;
    const data = await TripService.fetchMyBookings(userId);
    res.status(200).json(data);
  } catch (err) {
    sendError(res, err);
  }
};
