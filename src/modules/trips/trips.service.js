const repo = require('./trips.repo');

exports.createTrip = async (data) => {
  const fromLocation = data.fromLocation || "Noma'lum joy";
  const toLocation = data.toLocation || "Noma'lum joy";

  const date = data.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const time = data.time || "00:00"; // HH:mm

  const priceNum = Number(data.price);
  if (Number.isNaN(priceNum)) throw new Error("Price noto'g'ri formatda");

  const seatsNum = parseInt(data.seats, 10);
  if (Number.isNaN(seatsNum) || seatsNum < 1 || seatsNum > 4) {
    throw new Error("Seats 1..4 oralig'ida bo'lishi kerak");
  }

  const driverId = data.driverId || null;

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

  const departureTime = `${date}T${time}:00+05:00`;

  const dbPayload = {
    driver_id: driverId,
    from_city: fromLocation,
    to_city: toLocation,
    departure_time: departureTime,
    price: priceNum,
    available_seats: seatsNum,

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

  // ✅ MUHIM: seat rows yaratamiz (1..4)
  await repo.initTripSeats(newTrip.id, seatsNum);

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

// ✅ Trip Details: trip + seats
exports.getTripDetails = async (tripId) => {
  const { data: trip, error: e1 } = await repo.getTripById(tripId);
  if (e1) throw e1;

  const { data: seats, error: e2 } = await repo.getTripSeats(tripId);
  if (e2) throw e2;

  return { trip, seats };
};

// ✅ Seat book (V1)
exports.bookSeat = async ({ tripId, seatNo, clientId, holderName }) => {
  const { data: updated, error } = await repo.bookSeat({
    tripId,
    seatNo,
    clientId,
    holderName
  });

  if (error) throw error;

  // ✅ 0 row bo‘lsa => available emas (already booked/blocked)
  if (!updated) {
    const err = new Error("Seat available emas");
    err.code = "SEAT_NOT_AVAILABLE";
    throw err;
  }

  // MVP: available_seats - 1
  const { error: e3 } = await repo.decrementTripAvailableSeats(tripId);
  if (e3) throw e3;

  // Return refreshed details
  return await exports.getTripDetails(tripId);
};
