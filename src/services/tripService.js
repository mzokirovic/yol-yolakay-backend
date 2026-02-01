const supabase = require('../config/supabase');

exports.createTrip = async (data) => {
  // 1. Androiddan kelayotgan JSON
  const {
    fromLocation, // Android: "Toshkent"
    toLocation,   // Android: "Samarqand"
    date,         // Android: "2026-02-02"
    time,         // Android: "10:30"
    price,
    seats,
    driverId,     // Android: "uuid-code..."
    fromLat, fromLng,
    toLat, toLng
  } = data;

  // 2. Bazaga moslash (Mapping)
  // SQL jadvalingizdagi nomlar bilan bir xil bo'lishi shart!

  const dbPayload = {
    driver_id: driverId,           // Bazada: driver_id
    from_city: fromLocation,       // Bazada: from_city
    to_city: toLocation,           // Bazada: to_city

    // Sana va vaqtni birlashtiramiz (Postgres TIMESTAMP uchun)
    departure_time: `${date}T${time}:00`,

    price: price.toString(),       // Bazada price TEXT bo'lishi mumkin
    available_seats: seats,        // Bazada: available_seats

    // Qo'shimcha majburiy maydonlar (bo'sh qolmasligi uchun)
    driver_name: "Test Haydovchi",
    car_model: "Chevrolet Gentra",
    phone_number: "+998901234567",

    // Koordinatalar (Ikkita formatda yozamiz, qaysi biri borligiga qarab)
    start_lat: fromLat,
    start_lng: fromLng,
    end_lat: toLat,
    end_lng: toLng,
    // Agar eski camelCase ustunlar qolib ketgan bo'lsa:
    startLat: fromLat,
    startLng: fromLng,
    endLat: toLat,
    endLng: toLng
  };

  console.log("🛠 Supabasega yuborilayotgan ma'lumot:", dbPayload);

  // 3. Insert
  const { data: newTrip, error } = await supabase
    .from('trips')
    .insert([dbPayload])
    .select()
    .single();

  if (error) {
    console.error("❌ Supabase Xatosi:", error.message);
    console.error("Batafsil:", error);
    throw new Error(error.message);
  }

  return newTrip;
};