const tripService = require('../services/tripService');

exports.publishTrip = async (req, res) => {
  try {
    // Androiddan kelayotgan body
    const tripData = req.body;

    // Validatsiya (o'ta sodda ko'rinishda)
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