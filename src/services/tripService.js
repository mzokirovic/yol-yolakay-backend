const supabase = require('../config/supabase');

exports.createTrip = async (data) => {
  console.log("🛠 Servisga kelgan xom ma'lumot:", data);

  // 1) Sanitizing + normalizatsiya
  const fromLocation = data.fromLocation || "Noma'lum joy";
  const toLocation = data.toLocation || "Noma'lum joy";

  const date = data.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const time = data.time || "00:00"; // HH:mm

  // ✅ price: number bo‘lishi kerak
  const priceNum = Number(data.price);
  if (Number.isNaN(priceNum)) {
    throw new Error("Price noto'g'ri formatda");
  }

  // ✅ seats: 1..4
  const seatsNum = parseInt(data.seats, 10);
  if (Number.isNaN(seatsNum) || seatsNum < 1 || seatsNum > 4) {
    throw new Error("Seats 1..4 oralig'ida bo'lishi kerak");
  }

  const driverId = data.driverId || null;

  // coords
  const fromLat = Number(data.fromLat);
  const fromLng = Number(data.fromLng);
  const toLat = Number(data.toLat);
  const toLng = Number(data.toLng);

  const safeCoords = {
    fromLat: Number.isFinite(fromLat) ? fromLat : 0.0,
    fromLng: Number.isFinite(fromLng) ? fromLng : 0.0,
    toLat: Number.isFinite(toLat) ? toLat : 0.0,
    toLng: Number.isFinite(toLng) ? toLng : 0.0,
  };

  // ✅ departure_time: timezone bilan (Uzbekistan +05:00)
  const departureTime = `${date}T${time}:00+05:00`;

  // 2) DB payload (snake_case)
  const dbPayload = {
    driver_id: driverId,
    from_city: fromLocation,
    to_city: toLocation,
    departure_time: departureTime,
    price: priceNum,
    available_seats: seatsNum,

    // Majburiy maydonlar (hozircha test)
    driver_name: "Test Haydovchi",
    car_model: "Chevrolet",
    phone_number: "+998900000000",
    status: "active",

    start_lat: safeCoords.fromLat,
    start_lng: safeCoords.fromLng,
    end_lat: safeCoords.toLat,
    end_lng: safeCoords.toLng
  };

  console.log("📡 Supabasega yuborilayotgan paket:", dbPayload);

  // 3) INSERT
  const { data: newTrip, error } = await supabase
    .from('trips')
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    console.error("❌ BAZA XATOSI:", error.message);
    console.error("Hamma detallar:", error);
    throw new Error(error.message);
  }

  return newTrip;
};
