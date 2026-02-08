// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/trips/trips.controller.js

const tripService = require('./trips.service');
const pricingService = require('./pricing.service');
const supabase = require('../../core/db/supabase');

function getUserId(req) {
  // ✅ Endi faqat JWT (requireAuth) orqali
  const uid = req.user?.id;
  if (!uid) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return String(uid);
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

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// --- CONTROLLER METHODS ---

exports.calculatePricePreview = async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.body || {};

    const aLat = toNum(fromLat);
    const aLng = toNum(fromLng);
    const bLat = toNum(toLat);
    const bLng = toNum(toLng);

    if (aLat == null || aLng == null || bLat == null || bLng == null) {
      return res.status(400).json({
        success: false,
        error: { message: "Valid coords required (fromLat/fromLng/toLat/toLng)" }
      });
    }

    const dist = pricingService.calculateDistance(aLat, aLng, bLat, bLng);
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
    const userId = getUserId(req); // ✅ JWT user
    const b = req.body || {};

    const fromLocation = b.fromLocation ?? b.from_city;
    const toLocation = b.toLocation ?? b.to_city;

    const fromPointId = b.fromPointId || null;
    const toPointId = b.toPointId || null;

    const fromLat = toNum(b.fromLat ?? b.start_lat);
    const fromLng = toNum(b.fromLng ?? b.start_lng);
    const toLat = toNum(b.toLat ?? b.end_lat);
    const toLng = toNum(b.toLng ?? b.end_lng);

    const date = b.date;
    const time = b.time;

    const price = toNum(b.price);
    const seats = parseInt(b.seats ?? b.available_seats, 10);

    // ✅ Validatsiyalar (real publish uchun shart)
    if (!fromLocation || !toLocation) {
      return res.status(400).json({ success: false, error: { message: "Manzillar kiritilmadi" } });
    }
    if (!date || !time) {
      return res.status(400).json({ success: false, error: { message: "Sana va vaqt shart" } });
    }
    if (price == null || price <= 0) {
      return res.status(400).json({ success: false, error: { message: "Narx noto‘g‘ri" } });
    }
    if (Number.isNaN(seats) || seats < 1 || seats > 4) {
      return res.status(400).json({ success: false, error: { message: "Seats 1..4 bo‘lishi kerak" } });
    }
    if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
      return res.status(400).json({ success: false, error: { message: "Koordinatalar topilmadi" } });
    }

    const tripData = {
      fromLocation,
      toLocation,
      fromPointId,
      toPointId,
      fromLat,
      fromLng,
      toLat,
      toLng,
      date,
      time,
      price,
      seats,
    };

    const newTrip = await tripService.createTrip(tripData, userId);

    return res.status(201).json({
      success: true,
      message: "Safar e'lon qilindi!",
      trip: newTrip
    });
  } catch (error) {
    console.error("Publish Error:", error);

    const code = error.statusCode || error.status || 400;
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
    const result = await tripService.getUserTrips(userId);

    // service sizda {data, error} qaytaryapti
    if (result?.error) {
      return res.status(500).json({ success: false, error: { message: result.error.message } });
    }

    const data = result?.data ?? [];
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    const code = error.statusCode || error.status || 500;
    return res.status(code).json({ success: false, error: { message: error.message } });
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

// --- SEAT ACTIONS ---

exports.requestSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const { holderName } = req.body || {};

    const data = await tripService.requestSeat({
      tripId: id,
      seatNo: parseSeatNo(seatNo),
      clientId: userId,
      holderName
    });

    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const code = e.statusCode || e.status || 500;
    return res.status(code).json({ success: false, error: { message: e.message } });
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;

    const data = await tripService.cancelRequest({
      tripId: id,
      seatNo: parseSeatNo(seatNo),
      clientId: userId
    });

    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const code = e.statusCode || e.status || 500;
    return res.status(code).json({ success: false, error: { message: e.message } });
  }
};

exports.approveSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;

    const data = await tripService.approveSeat({
      tripId: id,
      seatNo: parseSeatNo(seatNo),
      driverId: userId
    });

    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const code = e.statusCode || e.status || 500;
    return res.status(code).json({ success: false, error: { message: e.message } });
  }
};

exports.rejectSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;

    const data = await tripService.rejectSeat({
      tripId: id,
      seatNo: parseSeatNo(seatNo),
      driverId: userId
    });

    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const code = e.statusCode || e.status || 500;
    return res.status(code).json({ success: false, error: { message: e.message } });
  }
};

exports.blockSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;

    const data = await tripService.blockSeat({
      tripId: id,
      seatNo: parseSeatNo(seatNo),
      driverId: userId
    });

    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const code = e.statusCode || e.status || 500;
    return res.status(code).json({ success: false, error: { message: e.message } });
  }
};

exports.unblockSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;

    const data = await tripService.unblockSeat({
      tripId: id,
      seatNo: parseSeatNo(seatNo),
      driverId: userId
    });

    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const code = e.statusCode || e.status || 500;
    return res.status(code).json({ success: false, error: { message: e.message } });
  }
};
