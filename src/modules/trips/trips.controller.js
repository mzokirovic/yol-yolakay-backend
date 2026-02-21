// src/modules/trips/trips.controller.js
const tripService = require('./trips.service');
const pricingService = require('./pricing.service');
const supabase = require('../../core/db/supabase');

function getUserId(req) {
  const uid = req.user?.id;
  if (!uid) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return uid;
}

function parseSeatNo(seatNo) {
  const seat = parseInt(seatNo, 10);
  if (Number.isNaN(seat) || seat < 1 || seat > 4) {
    const err = new Error('seatNo must be 1..4');
    err.statusCode = 400;
    throw err;
  }
  return seat;
}

function mapErrorStatus(e) {
  if (e.code === "FORBIDDEN") return 403;
  if (e.code === "INVALID_STATE") return 409;
  if (e.code === "SEAT_NOT_AVAILABLE") return 409;
  return e.statusCode || 500;
}


function isNil(v) { return v === null || v === undefined; }

// ---------------- CONTROLLERS ----------------

exports.calculatePricePreview = async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.body || {};
    if ([fromLat, fromLng, toLat, toLng].some(isNil)) {
      return res.status(400).json({ success: false, error: { message: "Coords required" } });
    }

    const dist = pricingService.calculateDistance(fromLat, fromLng, toLat, toLng);
    const pricing = pricingService.calculateTripPrice(dist);
    return res.status(200).json({ success: true, ...pricing });
    } catch (e) {
      return res.status(mapErrorStatus(e)).json({ success: false, error: { message: e.message } });
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

    const tripData = {
      fromLocation: b.fromLocation ?? b.from_city,
      toLocation: b.toLocation ?? b.to_city,
      fromPointId: b.fromPointId || null,
      toPointId: b.toPointId || null,

      fromLat: b.fromLat ?? b.start_lat,
      fromLng: b.fromLng ?? b.start_lng,
      toLat: b.toLat ?? b.end_lat,
      toLng: b.toLng ?? b.end_lng,

      date: b.date,
      time: b.time,
      price: Number(b.price),
      seats: parseInt(b.seats ?? b.available_seats, 10),
    };

    if (!tripData.fromLocation || !tripData.toLocation) {
      return res.status(400).json({ success: false, error: { message: "Manzillar kiritilmadi" } });
    }
    if (!Number.isFinite(tripData.price) || tripData.price <= 0) {
      return res.status(400).json({ success: false, error: { message: "Narx noto‘g‘ri" } });
    }
    if (Number.isNaN(tripData.seats)) {
      return res.status(400).json({ success: false, error: { message: "Seats noto‘g‘ri" } });
    }

    const newTrip = await tripService.createTrip(tripData, userId);

    return res.status(201).json({
      success: true,
      message: "Safar e'lon qilindi!",
      trip: newTrip
    });
  } catch (error) {
    const code = error.statusCode || 400;
    return res.status(code).json({ success: false, error: { message: error.message } });
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
    const out = await tripService.getUserTrips(userId);
    const list = out?.data || [];
    return res.status(200).json({ success: true, count: list.length, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

exports.getTripDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id || null;
    const data = await tripService.getTripDetails(id, viewerId);
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(mapErrorStatus(e)).json({ success: false, error: { message: e.message } });
  }
};


// Seat actions
exports.requestSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const { holderName } = req.body || {};
    const data = await tripService.requestSeat({
      tripId: id, seatNo: parseSeatNo(seatNo), clientId: userId, holderName
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const data = await tripService.cancelRequest({
      tripId: id, seatNo: parseSeatNo(seatNo), clientId: userId
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.approveSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const data = await tripService.approveSeat({
      tripId: id, seatNo: parseSeatNo(seatNo), driverId: userId
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.rejectSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const data = await tripService.rejectSeat({
      tripId: id, seatNo: parseSeatNo(seatNo), driverId: userId
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.blockSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const data = await tripService.blockSeat({
      tripId: id, seatNo: parseSeatNo(seatNo), driverId: userId
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.unblockSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const data = await tripService.unblockSeat({
      tripId: id, seatNo: parseSeatNo(seatNo), driverId: userId
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};


exports.startTrip = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const data = await tripService.startTrip({ tripId: id, driverId: userId });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const code =
      e.code === "FORBIDDEN" ? 403 :
      e.code === "INVALID_STATE" ? 409 :
      500;
    return res.status(code).json({ success: false, error: { message: e.message } });
  }
};

exports.finishTrip = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const data = await tripService.finishTrip({ tripId: id, driverId: userId });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const code =
      e.code === "FORBIDDEN" ? 403 :
      e.code === "INVALID_STATE" ? 409 :
      500;
    return res.status(code).json({ success: false, error: { message: e.message } });
  }
};
