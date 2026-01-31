const supabase = require('../config/supabase');

exports.createTrip = async (data) => {
  // 1. Androiddan kelgan ma'lumotni olamiz
  const {
    fromLocation,
    toLocation,
    date,
    time,
    price,
    seats,
    driverId, // Buni Token orqali olish kerak aslida
    // Koordinatalar (Android bularni ham jo'natishi kerak bo'ladi)
    fromLat, fromLng,
    toLat, toLng
  } = data;

  // 2. Supabasega yozish
  const { data: newTrip, error } = await supabase
    .from('trips')
    .insert([
      {
        driver_id: driverId || '00000000-0000-0000-0000-000000000000', // Vaqtincha ID
        from_location: fromLocation,
        to_location: toLocation,

        // PostGIS formati: ST_Point(lon, lat)
        from_coords: `POINT(${fromLng} ${fromLat})`,
        to_coords: `POINT(${toLng} ${toLat})`,

        departure_date: date,
        departure_time: time,
        price: price,
        seats: seats
      }
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return newTrip;
};