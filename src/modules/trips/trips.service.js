const repo = require('./trips.repo');

exports.createTrip = async (data) => {
  // 1) Sanitizing + normalizatsiya
  const fromLocation = data.fromLocation || "Noma'lum joy";
  const toLocation = data.toLocation || "Noma'lum joy";

  const date = data.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const time = data.time || "00:00"; // HH:mm

  // price: number
  const priceNum = Number(data.price);
  if (Number.isNaN(priceNum)) throw new Error("Price noto'g'ri formatda");

  // seats: 1..4
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

  // departure_time (Uzbekistan +05:00)
  const departureTime = `${date}T${time}:00+05:00`;

  // 2) DB payload
  const dbPayload = {
    driver_id: driverId,
    from_city: fromLocation,
    to_city: toLocation,
    departure_time: departureTime,
    price: priceNum,
    available_seats: seatsNum,

    // MVP: test data
    driver_name: "Test Haydovchi",
    car_model: "Chevrolet",
    phone_number: "+998900000000",
    status: "active",

    start_lat: safeCoords.fromLat,
    start_lng: safeCoords.fromLng,
    end_lat: safeCoords.toLat,
    end_lng: safeCoords.toLng
  };

  const { data: newTrip, error } = await repo.insertTrip(dbPayload);
  if (error) throw error;
  return newTrip;
};

exports.searchTrips = async ({ from, to, date, passengers }) => {
  const { data, error } = await repo.searchTrips({ from, to, date, passengers });
  if (error) throw error;
  return data;
};

exports.getMyTrips = async ({ driverName }) => {
  const { data, error } = await repo.getMyTrips({ driverName });
  if (error) throw error;
  return data;
};
