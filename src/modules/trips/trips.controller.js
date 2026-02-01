const tripService = require('./trips.service');

exports.publishTrip = async (req, res) => {
  try {
    const b = req.body || {};

    // ✅ camelCase + snake_case compatibility
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

    return res.status(200).json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    console.error("❌ Qidiruv xatosi:", error.message);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

exports.getMyTrips = async (req, res) => {
  try {
    const { driverName } = req.query;

    const list = await tripService.getMyTrips({ driverName });

    return res.status(200).json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};
