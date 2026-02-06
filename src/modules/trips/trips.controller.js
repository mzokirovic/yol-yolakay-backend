const tripService = require('./trips.service');
const supabase = require('../../core/db/supabase'); // ✅ Supabase ulash shart

// Xavfsiz ID olish
function getUserId(req) {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    const err = new Error("x-user-id yuborilmadi (Unauthorized)");
    err.status = 401;
    throw err;
  }
  return String(userId);
}

function parseSeatNo(seatNo) {
  const seat = parseInt(seatNo, 10);
  if (Number.isNaN(seat) || seat < 1 || seat > 4) {
    const err = new Error('seatNo 1..4 bo‘lishi kerak');
    err.status = 400;
    throw err;
  }
  return seat;
}

// --- CONTROLLER METHODS ---

// ✅ YANGI: Pitaklarni olish
exports.getPopularPoints = async (req, res) => {
  try {
    const { city } = req.query; // ?city=Toshkent (optional)

    let query = supabase
      .from('popular_points')
      .select('*')
      .eq('is_active', true);

    if (city) {
        // Katta-kichik harfni inobatga olmay qidirish (ilike)
        query = query.ilike('city_name', `%${city}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("Points Error:", error.message);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

exports.publishTrip = async (req, res) => {
  try {
    // 1. SECURITY: Driver ID faqat tokendan
    const userId = getUserId(req);
    const b = req.body || {};

    // 2. Data Mapping
    const tripData = {
      fromLocation: b.fromLocation ?? b.from_city,
      toLocation: b.toLocation ?? b.to_city,
      // Yangi: Point ID (agar bo'lsa)
      fromPointId: b.fromPointId || null,
      toPointId: b.toPointId || null,
      // Koordinatalar
      fromLat: b.fromLat ?? b.start_lat,
      fromLng: b.fromLng ?? b.start_lng,
      toLat: b.toLat ?? b.end_lat,
      toLng: b.toLng ?? b.end_lng,
      // Vaqt va narx
      date: b.date,
      time: b.time,
      price: parseFloat(b.price),
      seats: parseInt(b.seats ?? b.available_seats, 10),
    };

    // 3. Simple Validation
    if (!tripData.fromLocation || !tripData.toLocation) {
      return res.status(400).json({ success: false, error: { message: "Manzillar kiritilmadi" } });
    }
    if (!tripData.price || !tripData.seats) {
       return res.status(400).json({ success: false, error: { message: "Narx va o'rindiq soni kerak" } });
    }

    // 4. Call Service
    const newTrip = await tripService.createTrip(tripData, userId);

    // 5. Success
    return res.status(201).json({
      success: true,
      message: "Safar muvaffaqiyatli e'lon qilindi!",
      trip: newTrip,
      warning: newTrip.is_price_low ? "Diqqat: Narx bozor narxidan past." : null
    });

  } catch (error) {
    console.error("Publish Error:", error.message);
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
    const { driverName } = req.query;
    const list = await tripService.getMyTrips({ driverName });
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

// ----------------- SEAT ACTIONS (To'liq Versiya) -----------------

exports.requestSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const seat = parseSeatNo(seatNo);
    const { holderName } = req.body || {};

    const data = await tripService.requestSeat({
        tripId: id,
        seatNo: seat,
        clientId: userId,
        holderName
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    if (e.code === 'SEAT_NOT_AVAILABLE') return res.status(409).json({ success: false, error: { message: e.message } });
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const seat = parseSeatNo(seatNo);

    const data = await tripService.cancelRequest({
        tripId: id,
        seatNo: seat,
        clientId: userId
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
    const seat = parseSeatNo(seatNo);

    const data = await tripService.approveSeat({
        tripId: id,
        seatNo: seat,
        driverId: userId
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const status = e.code === 'FORBIDDEN' ? 403 : 500;
    return res.status(status).json({ success: false, error: { message: e.message } });
  }
};

exports.rejectSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const seat = parseSeatNo(seatNo);

    const data = await tripService.rejectSeat({
        tripId: id,
        seatNo: seat,
        driverId: userId
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const status = e.code === 'FORBIDDEN' ? 403 : 500;
    return res.status(status).json({ success: false, error: { message: e.message } });
  }
};

exports.blockSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const seat = parseSeatNo(seatNo);

    const data = await tripService.blockSeat({
        tripId: id,
        seatNo: seat,
        driverId: userId
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const status = e.code === 'FORBIDDEN' ? 403 : 500;
    return res.status(status).json({ success: false, error: { message: e.message } });
  }
};

exports.unblockSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const seat = parseSeatNo(seatNo);

    const data = await tripService.unblockSeat({
        tripId: id,
        seatNo: seat,
        driverId: userId
    });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    const status = e.code === 'FORBIDDEN' ? 403 : 500;
    return res.status(status).json({ success: false, error: { message: e.message } });
  }
};