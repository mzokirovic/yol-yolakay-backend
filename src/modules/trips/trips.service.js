const repo = require('./trips.repo');
// ✅ 1. Notification tizimini ulaymiz
const notifRepo = require('../notifications/notifications.repo');
const { sendToToken } = require('../../core/fcm');

// ✅ 2. Yordamchi funksiya: Push Notification yuborish
async function notifyUser(userId, title, body, type, data = {}) {
  try {
    if (!userId) return;

    // Userning tokenlarini olamiz
    const { data: tokens } = await notifRepo.listDeviceTokens(userId);
    if (!tokens || tokens.length === 0) return;

    const payload = {
      title,
      body,
      type, // Masalan: TRIP_REQUEST, TRIP_APPROVED
      ...data
    };

    // Barcha tokenlarga parallel yuboramiz
    const promises = tokens.map(t => sendToToken(t.token, payload));
    await Promise.allSettled(promises);
    console.log(`🔔 Notification sent to ${userId}: ${title}`);
  } catch (e) {
    console.error(`⚠️ Notification error for ${userId}:`, e.message);
    // Xato bo'lsa ham kod to'xtamasligi kerak, bu fon jarayoni
  }
}

async function assertDriver(tripId, driverId) {
  const { data: trip, error } = await repo.getTripById(tripId);
  if (error) throw error;

  if (!trip.driver_id) {
    const err = new Error("Trip driver_id yo‘q (MVP data). Driver action mumkin emas.");
    err.code = "FORBIDDEN";
    throw err;
  }

  if (String(trip.driver_id) !== String(driverId)) {
    const err = new Error("Bu action faqat haydovchiga ruxsat.");
    err.code = "FORBIDDEN";
    throw err;
  }

  return trip;
}

exports.createTrip = async (data) => {
  const fromLocation = data.fromLocation || "Noma'lum joy";
  const toLocation = data.toLocation || "Noma'lum joy";

  const date = data.date || new Date().toISOString().split('T')[0];
  const time = data.time || "00:00";

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

  await repo.initTripSeats(newTrip.id, seatsNum);

  const { error: e2 } = await repo.recalcTripAvailableSeats(newTrip.id);
  if (e2) throw e2;

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

exports.getTripDetails = async (tripId) => {
  const { data: trip, error: e1 } = await repo.getTripById(tripId);
  if (e1) throw e1;

  const { data: seats, error: e2 } = await repo.getTripSeats(tripId);
  if (e2) throw e2;

  return { trip, seats };
};

// -------------------- MVP+ pending flow (Notifications Added) --------------------

exports.requestSeat = async ({ tripId, seatNo, clientId, holderName }) => {
  const { data: updated, error } = await repo.requestSeat({
    tripId,
    seatNo,
    clientId,
    holderName
  });

  if (error) throw error;
  if (!updated) {
    const err = new Error("Seat available emas (band/pending/blocked)");
    err.code = "SEAT_NOT_AVAILABLE";
    throw err;
  }

  const { error: e2 } = await repo.recalcTripAvailableSeats(tripId);
  if (e2) throw e2;

  // Ma'lumotlarni qaytarishdan oldin notification yuboramiz
  const result = await exports.getTripDetails(tripId);

  // ✅ SENIOR LOGIC: Haydovchiga xabar beramiz
  if (result.trip && result.trip.driver_id) {
      await notifyUser(
          result.trip.driver_id,
          "Yangi buyurtma! 🚖",
          `${holderName || "Bir yo'lovchi"} joy band qilmoqchi.`,
          "TRIP_REQUEST",
          { trip_id: tripId, seat_no: String(seatNo) }
      );
  }

  return result;
};

exports.cancelRequest = async ({ tripId, seatNo, clientId }) => {
  const { error } = await repo.cancelRequest({ tripId, seatNo, clientId });
  if (error) throw error;

  const { error: e2 } = await repo.recalcTripAvailableSeats(tripId);
  if (e2) throw e2;

  const result = await exports.getTripDetails(tripId);

  // ✅ SENIOR LOGIC: Haydovchiga xabar beramiz (Bekor qilindi)
  if (result.trip && result.trip.driver_id) {
      await notifyUser(
          result.trip.driver_id,
          "Buyurtma bekor qilindi ⚠️",
          "Yo'lovchi joy so'rovini bekor qildi.",
          "TRIP_CANCELLED",
          { trip_id: tripId, seat_no: String(seatNo) }
      );
  }

  return result;
};

exports.approveSeat = async ({ tripId, seatNo, driverId }) => {
  await assertDriver(tripId, driverId);

  // 1. Avval kim o'tirganini bilishimiz kerak (notification uchun)
  // Buning uchun hozirgi holatni olamiz
  const { data: seatsBefore } = await repo.getTripSeats(tripId);
  const targetSeat = seatsBefore.find(s => s.seat_no === parseInt(seatNo));

  const { data: updated, error } = await repo.approveSeat({ tripId, seatNo });
  if (error) throw error;

  if (!updated) {
    const err = new Error("Approve bo‘lmadi (seat pending emas yoki allaqachon o‘zgargan)");
    err.code = "SEAT_NOT_AVAILABLE";
    throw err;
  }

  const { error: e2 } = await repo.recalcTripAvailableSeats(tripId);
  if (e2) throw e2;

  // ✅ SENIOR LOGIC: Yo'lovchiga xabar beramiz (Tasdiqlandi)
  if (targetSeat && targetSeat.client_id) {
      await notifyUser(
          targetSeat.client_id,
          "So'rovingiz qabul qilindi! ✅",
          "Haydovchi buyurtmangizni tasdiqladi. Yo'lga tayyorlaning!",
          "TRIP_APPROVED",
          { trip_id: tripId, seat_no: String(seatNo) }
      );
  }

  return await exports.getTripDetails(tripId);
};

exports.rejectSeat = async ({ tripId, seatNo, driverId }) => {
  await assertDriver(tripId, driverId);

  // 1. Avval kim o'tirganini bilamiz
  const { data: seatsBefore } = await repo.getTripSeats(tripId);
  const targetSeat = seatsBefore.find(s => s.seat_no === parseInt(seatNo));

  const { error } = await repo.rejectSeat({ tripId, seatNo });
  if (error) throw error;

  const { error: e2 } = await repo.recalcTripAvailableSeats(tripId);
  if (e2) throw e2;

  // ✅ SENIOR LOGIC: Yo'lovchiga xabar beramiz (Rad etildi)
  if (targetSeat && targetSeat.client_id) {
      await notifyUser(
          targetSeat.client_id,
          "So'rovingiz rad etildi ❌",
          "Afsuski, haydovchi buyurtmani qabul qilmadi.",
          "TRIP_REJECTED",
          { trip_id: tripId, seat_no: String(seatNo) }
      );
  }

  return await exports.getTripDetails(tripId);
};

// -------------------- Driver block/unblock --------------------

exports.blockSeat = async ({ tripId, seatNo, driverId }) => {
  await assertDriver(tripId, driverId);

  const { data: updated, error } = await repo.blockSeatByDriver({ tripId, seatNo });
  if (error) throw error;

  if (!updated) {
    const err = new Error("Seat block qilib bo‘lmadi (pending/booked/blocked)");
    err.code = "SEAT_NOT_AVAILABLE";
    throw err;
  }

  const { error: e2 } = await repo.recalcTripAvailableSeats(tripId);
  if (e2) throw e2;

  return await exports.getTripDetails(tripId);
};

exports.unblockSeat = async ({ tripId, seatNo, driverId }) => {
  await assertDriver(tripId, driverId);

  const { data: updated, error } = await repo.unblockSeatByDriver({ tripId, seatNo });
  if (error) throw error;

  if (!updated) throw new Error("Seat unblock qilib bo‘lmadi (driver block qilmagan yoki boshqa holat)");

  const { error: e2 } = await repo.recalcTripAvailableSeats(tripId);
  if (e2) throw e2;

  return await exports.getTripDetails(tripId);
};