// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/trips/trips.controller.js

const tripService = require('./trips.service');
const pricingService = require('./pricing.service');
const supabase = require('../../core/db/supabase');

function getUserId(req) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    // Agar token bo'lsa, o'shandan ham olishga urinib ko'ramiz
    if (req.user && req.user.id) return req.user.id;
    const err = new Error("x-user-id required");
    err.status = 401;
    throw err;
  }
  return String(userId);
}

function parseSeatNo(seatNo) {
  const seat = parseInt(seatNo, 10);
  if (Number.isNaN(seat) || seat < 1 || seat > 4) throw new Error('seatNo must be 1..4');
  return seat;
}

// --- CONTROLLER METHODS ---

exports.calculatePricePreview = async (req, res) => {
    try {
        const { fromLat, fromLng, toLat, toLng } = req.body;
        if (!fromLat || !toLat) return res.status(400).json({ success: false, message: "Coords required" });

        const dist = pricingService.calculateDistance(fromLat, fromLng, toLat, toLng);
        const pricing = pricingService.calculateTripPrice(dist);
        return res.status(200).json({ success: true, ...pricing });
    } catch (e) {
        return res.status(500).json({ success: false, error: { message: e.message } });
    }
};

exports.getPopularPoints = async (req, res) => {
  try {
    const { city } = req.query;
    let query = supabase.from('popular_points').select('*').eq('is_active', true);
    if (city) query = query.ilike('city_name', `%${city}%`);
    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

exports.publishTrip = async (req, res) => {
  try {
    const userId = getUserId(req);
    const b = req.body || {};

    // Android CamelCase yuboradi, biz Servicega tayyorlab beramiz
    const tripData = {
      fromLocation: b.fromLocation ?? b.from_city,
      toLocation: b.toLocation ?? b.to_city,
      fromPointId: b.fromPointId || null,
      toPointId: b.toPointId || null,

      // Koordinatalar
      fromLat: b.fromLat ?? b.start_lat,
      fromLng: b.fromLng ?? b.start_lng,
      toLat: b.toLat ?? b.end_lat,
      toLng: b.toLng ?? b.end_lng,

      date: b.date,
      time: b.time,
      price: parseFloat(b.price),
      seats: parseInt(b.seats ?? b.available_seats, 10),
    };

    if (!tripData.fromLocation || !tripData.toLocation) {
      return res.status(400).json({ success: false, error: { message: "Manzillar kiritilmadi" } });
    }

    const newTrip = await tripService.createTrip(tripData, userId);

    return res.status(201).json({
      success: true,
      message: "Safar e'lon qilindi!",
      trip: newTrip
    });

  } catch (error) {
    console.error("Publish Error:", error);
    return res.status(400).json({ success: false, error: { message: error.message } });
  }
};

exports.searchTrips = async (req, res) => {
  try {
    const { from, to, date, passengers } = req.query;
    const list = await tripService.searchTrips({ from, to, date, passengers });
    return res.status(200).json({ success: true, count: list.length, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

exports.getMyTrips = async (req, res) => {
  try {
    const userId = getUserId(req);
    const list = await tripService.getUserTrips(userId);
    return res.status(200).json({ success: true, count: list.length, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

exports.getTripDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await tripService.getTripDetails(id);
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

// Seat actions
exports.requestSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const { holderName } = req.body || {};
    const data = await tripService.requestSeat({ tripId: id, seatNo: parseSeatNo(seatNo), clientId: userId, holderName });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const data = await tripService.cancelRequest({ tripId: id, seatNo: parseSeatNo(seatNo), clientId: userId });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.approveSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const data = await tripService.approveSeat({ tripId: id, seatNo: parseSeatNo(seatNo), driverId: userId });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.rejectSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const data = await tripService.rejectSeat({ tripId: id, seatNo: parseSeatNo(seatNo), driverId: userId });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.blockSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const data = await tripService.blockSeat({ tripId: id, seatNo: parseSeatNo(seatNo), driverId: userId });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.unblockSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const data = await tripService.unblockSeat({ tripId: id, seatNo: parseSeatNo(seatNo), driverId: userId });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};