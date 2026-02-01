const supabase = require('../config/supabase');

exports.createTrip = async (data) => {
  // 1. Androiddan kelgan ma'lumotlar
  const {
    fromLocation,
    toLocation,
    date,
    time,
    price,
    seats,
    driverId,
    // Koordinatalar
    fromLat, fromLng,
    toLat, toLng
  } = data;

  // 2. Sanani va Vaqtni birlashtiramiz (Bazadagi 'departure_time' uchun)
  // Masalan: "2026-02-02 09:30:00"
  const fullDepartureTime = `${date}T${time}:00`;

  // 3. Supabasega yozish (Sizning SQL strukturangiz bo'yicha)
  const { data: newTrip, error } = await supabase
    .from('trips') // Jadval nomi
    .insert([
      {
        // --- ASOSIY USTUNLAR (Sizning SQL bo'yicha) ---
        driver_id: driverId,

        from_city: fromLocation,  // Node.js dagi 'fromLocation' -> Bazadagi 'from_city' ga tushadi
        to_city: toLocation,      // 'toLocation' -> 'to_city' ga

        departure_time: fullDepartureTime, // Yig'ilgan vaqt

        price: price.toString(), // Bazada narx matn (string) ko'rinishida ekan
        available_seats: seats,  // 'seats' -> 'available_seats' ga

        // --- MAJBURIY BO'LISHI MUMKIN BO'LGAN USTUNLAR ---
        // Android hozircha bularni jo'natmayapti, shuning uchun "fake" ma'lumot tiqib turamiz.
        // Keyinchalik bularni ham Androiddan olamiz.
        driver_name: "Test Haydovchi",
        car_model: "Chevrolet Gentra",
        phone_number: "+998901234567",

        // --- KOORDINATALAR ---
        // Sizning SQL da ham 'startLat', ham 'start_lat' bor ekan.
        // Ikkalasiga ham yozib qo'yaveramiz (ehtiyot shart)
        start_lat: fromLat,
        start_lng: fromLng,
        end_lat: toLat,
        end_lng: toLng,

        startLat: fromLat,
        startLng: fromLng,
        endLat: toLat,
        endLng: toLng
      }
    ])
    .select()
    .single();

  if (error) {
    console.error("Supabase Error:", error); // Xatoni konsolga chiqarish
    throw new Error(error.message);
  }

  return newTrip;
};