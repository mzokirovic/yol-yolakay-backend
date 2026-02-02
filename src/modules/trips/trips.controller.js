const tripService = require('./trips.service');

function getUserId(req) {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    const err = new Error("x-user-id yuborilmadi (yoki ?userId=...)");
    err.status = 400;
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

exports.publishTrip = async (req, res) => {
  try {
    const b = req.body || {};

    const tripData = {
      fromLocation: b.fromLocation ?? b.from_city,
      toLocation: b.toLocation ?? b.to_city,

      fromLat: b.fromLat ?? b.start_lat ?? b.startLat,
      fromLng: b.fromLng ?? b.start_lng ?? b.startLng,
      toLat: b.toLat ?? b.end_lat ?? b.endLat,
      toLng: b.toLng ?? b.end_lng ?? b.endLng,

      date: b.date,
      time: b.time,
      price: b.price,
      seats: b.seats ?? b.available_seats,
      driverId: b.driverId ?? b.driver_id,
    };

    if (!tripData.fromLocation || !tripData.toLocation || tripData.price == null || tripData.seats == null) {
      return res.status(400).json({ success: false, error: { message: "Ma'lumotlar to'liq emas" } });
    }

    const seatsNum = parseInt(tripData.seats, 10);
    if (Number.isNaN(seatsNum) || seatsNum < 1 || seatsNum > 4) {
      return res.status(400).json({ success: false, error: { message: "Seats 1..4 bo'lishi kerak" } });
    }

    const newTrip = await tripService.createTrip({ ...tripData, seats: seatsNum });

    return res.status(201).json({
      success: true,
      message: "Safar muvaffaqiyatli e'lon qilindi!",
      trip: newTrip
    });
  } catch (error) {
    console.error("Controller Error:", error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

exports.searchTrips = async (req, res) => {
  try {
    const { from, to, date, passengers } = req.query;
    const list = await tripService.searchTrips({ from, to, date, passengers });

    return res.status(200).json({ success: true, count: list.length, data: list });
  } catch (error) {
    console.error("❌ Qidiruv xatosi:", error.message);
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

// ----------------- Driver: block/unblock -----------------

exports.blockSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const seat = parseSeatNo(seatNo);

    const data = await tripService.blockSeat({ tripId: id, seatNo: seat, driverId: userId });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ success: false, error: { message: e.message } });
    if (e.code === 'SEAT_NOT_AVAILABLE') return res.status(409).json({ success: false, error: { message: e.message } });
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.unblockSeat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, seatNo } = req.params;
    const seat = parseSeatNo(seatNo);

    const data = await tripService.unblockSeat({ tripId: id, seatNo: seat, driverId: userId });
    return res.status(200).json({ success: true, trip: data.trip, seats: data.seats });
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ success: false, error: { message: e.message } });
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

// ----------------- MVP+: pending flow -----------------

// Passenger: available -> pending
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

// Passenger: pending(mine) -> available
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

// Driver: pending -> booked
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
    if (e.code === 'FORBIDDEN') return res.status(403).json({ success: false, error: { message: e.message } });
    if (e.code === 'SEAT_NOT_AVAILABLE') return res.status(409).json({ success: false, error: { message: e.message } });
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

// Driver: pending -> available
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
    if (e.code === 'FORBIDDEN') return res.status(403).json({ success: false, error: { message: e.message } });
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};
