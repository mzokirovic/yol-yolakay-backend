const supabase = require('../config/supabase');

exports.createTrip = async (data) => {
  console.log("🛠 Servisga kelgan xom ma'lumot:", data);

  // 1. MA'LUMOTLARNI TOZALASH (Sanitizing)
  // Agar Androiddan biror narsa kelmay qolsa, server qulamasligi kerak!
  const safeData = {
    fromLocation: data.fromLocation || "Noma'lum joy",
    toLocation: data.toLocation || "Noma'lum joy",
    date: data.date || new Date().toISOString().split('T')[0],
    time: data.time || "00:00",
    price: data.price ? data.price.toString() : "0",
    seats: data.seats || 1,
    driverId: data.driverId,

    // Koordinatalar: Agar kelmasa 0.0 deb olamiz (Crash oldini oladi)
    fromLat: parseFloat(data.fromLat) || 0.0,
    fromLng: parseFloat(data.fromLng) || 0.0,
    toLat: parseFloat(data.toLat) || 0.0,
    toLng: parseFloat(data.toLng) || 0.0
  };

  // 2. BAZAGA MOSLASH
  // Supabase (PostgreSQL) odatda snake_case (pastki_chiziq) ishlatadi.
  const dbPayload = {
    driver_id: safeData.driverId,
    from_city: safeData.fromLocation,
    to_city: safeData.toLocation,
    departure_time: `${safeData.date}T${safeData.time}:00`,
    price: safeData.price,
    available_seats: safeData.seats,

    // Majburiy maydonlarni to'ldiramiz
    driver_name: "Test Haydovchi",
    car_model: "Chevrolet",
    phone_number: "+998900000000",
    status: "active",

    // Faqat snake_case variantini qoldiramiz (eng ishonchlisi)
    start_lat: safeData.fromLat,
    start_lng: safeData.fromLng,
    end_lat: safeData.toLat,
    end_lng: safeData.toLng
  };

  console.log("📡 Supabasega yuborilayotgan toza paket:", dbPayload);

  // 3. INSERT
  const { data: newTrip, error } = await supabase
    .from('trips') // Jadval nomi aniq 'trips' bo'lishi kerak
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    // Agar xato bo'lsa, uni terminalga aniq chiqarib beramiz
    console.error("❌ BAZA XATOSI:", error.message);
    console.error("Hamma detallar:", error);
    throw new Error(error.message);
  }

  return newTrip;
};