const tripService = require('../services/tripService');
const supabase = require('../config/supabase'); // <--- MUHIM: Qidiruv uchun bazani chaqiramiz

// 1. E'lon berish (POST)
exports.publishTrip = async (req, res) => {
  try {
    const tripData = req.body;

    if (!tripData.fromLocation || !tripData.price) {
      return res.status(400).json({ error: "Ma'lumotlar to'liq emas" });
    }

    const newTrip = await tripService.createTrip(tripData);

    res.status(201).json({
      message: "Safar muvaffaqiyatli e'lon qilindi!",
      trip: newTrip
    });
  } catch (error) {
    console.error("Controller Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 2. Safarlarni qidirish (GET) - YANGI QISM
exports.searchTrips = async (req, res) => {
  try {
    const { from, to, date } = req.query; // ?from=Toshkent&to=Samarqand

    console.log("🔍 Qidiruv:", { from, to, date });

    // Bazadan qidiramiz
    let query = supabase
      .from('trips')
      .select('*')
      .eq('status', 'active') // Faqat aktivlari
      .order('departure_time', { ascending: true });

    // Filtrlarni qo'shamiz
    if (from) query = query.ilike('from_city', `%${from}%`);
    if (to) query = query.ilike('to_city', `%${to}%`);
    if (date) query = query.gte('departure_time', `${date}T00:00:00`);

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data.length,
      data: data
    });

  } catch (error) {
    console.error("❌ Qidiruv xatosi:", error.message);
    res.status(500).json({ error: error.message });
  }
};