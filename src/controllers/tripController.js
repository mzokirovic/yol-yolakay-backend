const tripService = require('../services/tripService');
const supabase = require('../config/supabase');

// 1) E'lon berish (POST)
exports.publishTrip = async (req, res) => {
  try {
    const b = req.body || {};

    // ✅ Android hozir snake_case yuboryapti (from_city), keyin camelCase (fromLocation) bo'ladi.
    // Shuning uchun ikkalasini ham qabul qilamiz.
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

    // ✅ To'g'ri validation (0 bo'lsa ham xato qilmaydi)
    if (!tripData.fromLocation || !tripData.toLocation || tripData.price == null || tripData.seats == null) {
      return res.status(400).json({
        success: false,
        error: { message: "Ma'lumotlar to'liq emas" }
      });
    }

    const seatsNum = parseInt(tripData.seats, 10);
    if (Number.isNaN(seatsNum) || seatsNum < 1 || seatsNum > 4) {
      return res.status(400).json({
        success: false,
        error: { message: "Seats 1..4 bo'lishi kerak" }
      });
    }

    const newTrip = await tripService.createTrip({
      ...tripData,
      seats: seatsNum
    });

    return res.status(201).json({
      success: true,
      message: "Safar muvaffaqiyatli e'lon qilindi!",
      trip: newTrip
    });

  } catch (error) {
    console.error("Controller Error:", error);
    return res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};



exports.getMyTrips = async (req, res) => {
  try {
    const { driverName } = req.query;

    let query = supabase
      .from('trips')
      .select('*')
      .order('departure_time', { ascending: false });

    if (driverName) query = query.eq('driver_name', driverName);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};



// 2) Safarlarni qidirish (GET)
exports.searchTrips = async (req, res) => {
  try {
    const { from, to, date, passengers } = req.query;

    console.log("🔍 Qidiruv:", { from, to, date, passengers });

    let query = supabase
      .from('trips')
      .select('*')
      .eq('status', 'active')
      .order('departure_time', { ascending: true });

    if (from) query = query.ilike('from_city', `%${from}%`);
    if (to) query = query.ilike('to_city', `%${to}%`);

    // ✅ passengers filter: available_seats >= passengers
    const p = passengers ? parseInt(passengers, 10) : null;
    if (p && !Number.isNaN(p)) {
      query = query.gte('available_seats', p);
    }

    // ✅ date filter: faqat o'sha kun (>= start, < next day)
    if (date) {
      const start = `${date}T00:00:00+05:00`;

      // nextDate hisoblash: YYYY-MM-DD + 1 day
      const d = new Date(`${date}T00:00:00Z`); // UTC sifatida olamiz
      d.setUTCDate(d.getUTCDate() + 1);
      const nextDate = d.toISOString().slice(0, 10);

      const end = `${nextDate}T00:00:00+05:00`;

      query = query.gte('departure_time', start).lt('departure_time', end);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    console.error("❌ Qidiruv xatosi:", error.message);
    return res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};
