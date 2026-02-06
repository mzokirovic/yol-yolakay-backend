const repo = require('./trips.repo');
const notifRepo = require('../notifications/notifications.repo');
const pricingService = require('./pricing.service'); // ✅ YANGI: Narx logikasi
const supabase = require('../../core/db/supabase');  // ✅ YANGI: DB access
const { sendToToken } = require('../../core/fcm');

// --- HELPER FUNCTIONS ---

// 1. Push Notification yuborish
async function notifyUser(userId, title, body, type, data = {}) {
  try {
    if (!userId) return;
    const { data: tokens } = await notifRepo.listDeviceTokens(userId);
    if (!tokens || tokens.length === 0) return;

    const payload = { title, body, type, ...data };
    const promises = tokens.map(t => sendToToken(t.token, payload));
    await Promise.allSettled(promises);
    console.log(`🔔 Notification sent to ${userId}: ${title}`);
  } catch (e) {
    console.error(`⚠️ Notification error for ${userId}:`, e.message);
  }
}

// 2. Haydovchi ekanligini tekshirish
async function assertDriver(tripId, driverId) {
  const { data: trip, error } = await repo.getTripById(tripId);
  if (error) throw error;

  if (!trip.driver_id) {
    const err = new Error("Trip driver_id yo‘q (MVP data).");
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

// 3. ✅ YANGI: User va Mashina ma'lumotlarini olish
async function getDriverInfo(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, phone')
    .eq('user_id', userId)
    .single();

  if (!profile) throw new Error("Profil topilmadi. Iltimos avval ro'yxatdan o'ting.");

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('make, model, color, seats')
    .eq('user_id', userId)
    .single();

  if (!vehicle) throw new Error("Sizda ro'yxatdan o'tgan mashina yo'q. Avval mashina qo'shing.");

  return { profile, vehicle };
}

// 4. ✅ YANGI: Lokatsiyani aniqlash (Point ID vs Manual Coords)
async function resolveLocation(locationName, pointId, manualLat, manualLng) {
  if (pointId) {
      const { data: point } = await supabase
          .from('popular_points')
          .select('*')
          .eq('id', pointId)
          .single();

      if (point) {
          return {
              name: point.point_name,
              lat: point.latitude,
              lng: point.longitude,
              pointId: point.id
          };
      }
  }
  // Fallback: Manual coords
  return {
      name: locationName || "Noma'lum joy",
      lat: Number(manualLat) || 0.0,
      lng: Number(manualLng) || 0.0,
      pointId: null
  };
}

// --- MAIN BUSINESS LOGIC ---

exports.createTrip = async (data, userId) => {
  // 1. Data Integrity: Haydovchi va mashina bormi?
  const { profile, vehicle } = await getDriverInfo(userId);

  // 2. Lokatsiyalarni aniqlash
  const fromLoc = await resolveLocation(data.fromLocation, data.fromPointId, data.fromLat, data.fromLng);
  const toLoc = await resolveLocation(data.toLocation, data.toPointId, data.toLat, data.toLng);

  // 3. Sana va Vaqt validatsiyasi
  const departureTime = `${data.date}T${data.time}:00+05:00`;
  if (new Date(departureTime) < new Date()) {
      throw new Error("O'tib ketgan vaqtga e'lon berib bo'lmaydi.");
  }

  // 4. Narx Validatsiyasi (Smart Pricing)
  const distance = pricingService.calculateDistance(fromLoc.lat, fromLoc.lng, toLoc.lat, toLoc.lng);
  const priceCalc = pricingService.calculateTripPrice(distance);

  const priceCheck = pricingService.validatePrice(data.price, priceCalc);
  if (!priceCheck.valid) {
      throw new Error(priceCheck.message);
  }

  // 5. Seats check
  const seatsNum = parseInt(data.seats, 10);
  if (Number.isNaN(seatsNum) || seatsNum < 1 || seatsNum > 4) {
    throw new Error("Seats 1..4 oralig'ida bo'lishi kerak");
  }

  // 6. DB Payload (Real data bilan)
  const dbPayload = {
    driver_id: userId,

    // Snapshot data (tarix uchun)
    driver_name: profile.display_name,
    car_model: `${vehicle.make} ${vehicle.model} (${vehicle.color})`,
    phone_number: profile.phone,

    from_city: fromLoc.name,
    to_city: toLoc.name,
    departure_time: departureTime,

    price: data.price,
    available_seats: seatsNum,
    status: 'active',

    // Koordinatalar (Legacy & New)
    start_lat: fromLoc.lat,
    start_lng: fromLoc.lng,
    end_lat: toLoc.lat,
    end_lng: toLoc.lng,
    "startLat": fromLoc.lat,
    "startLng": fromLoc.lng,
    "endLat": toLoc.lat,
    "endLng": toLoc.lng,

    meeting_point_id: fromLoc.pointId
  };

  const { data: newTrip, error } = await repo.insertTrip(dbPayload);
  if (error) throw error;

  await repo.initTripSeats(newTrip.id, seatsNum);
  const { error: e2 } = await repo.recalcTripAvailableSeats(newTrip.id);
  if (e2) throw e2;

  // Frontga qo'shimcha info qaytaramiz
  newTrip.is_price_low = priceCheck.isLow;
  newTrip.recommended_price = priceCalc.recommended;

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

// --- SEAT REQUEST FLOW (Notification logic retained) ---

exports.requestSeat = async ({ tripId, seatNo, clientId, holderName }) => {
  const { data: updated, error } = await repo.requestSeat({ tripId, seatNo, clientId, holderName });
  if (error) throw error;
  if (!updated) {
    const err = new Error("Seat available emas");
    err.code = "SEAT_NOT_AVAILABLE";
    throw err;
  }
  await repo.recalcTripAvailableSeats(tripId);

  const result = await exports.getTripDetails(tripId);
  if (result.trip && result.trip.driver_id) {
      await notifyUser(result.trip.driver_id, "Yangi buyurtma! 🚖", `${holderName || "Bir yo'lovchi"} joy band qilmoqchi.`, "TRIP_REQUEST", { trip_id: tripId, seat_no: String(seatNo) });
  }
  return result;
};

exports.cancelRequest = async ({ tripId, seatNo, clientId }) => {
  const { error } = await repo.cancelRequest({ tripId, seatNo, clientId });
  if (error) throw error;
  await repo.recalcTripAvailableSeats(tripId);

  const result = await exports.getTripDetails(tripId);
  if (result.trip && result.trip.driver_id) {
      await notifyUser(result.trip.driver_id, "Buyurtma bekor qilindi ⚠️", "Yo'lovchi joy so'rovini bekor qildi.", "TRIP_CANCELLED", { trip_id: tripId, seat_no: String(seatNo) });
  }
  return result;
};

exports.approveSeat = async ({ tripId, seatNo, driverId }) => {
  await assertDriver(tripId, driverId);

  const { data: seatsBefore } = await repo.getTripSeats(tripId);
  const targetSeat = seatsBefore.find(s => s.seat_no === parseInt(seatNo));

  const { data: updated, error } = await repo.approveSeat({ tripId, seatNo });
  if (error) throw error;
  if (!updated) {
     const err = new Error("Approve bo‘lmadi");
     err.code = "SEAT_NOT_AVAILABLE";
     throw err;
  }
  await repo.recalcTripAvailableSeats(tripId);

  if (targetSeat && targetSeat.client_id) {
      await notifyUser(targetSeat.client_id, "So'rovingiz qabul qilindi! ✅", "Haydovchi buyurtmangizni tasdiqladi.", "TRIP_APPROVED", { trip_id: tripId, seat_no: String(seatNo) });
  }
  return await exports.getTripDetails(tripId);
};

exports.rejectSeat = async ({ tripId, seatNo, driverId }) => {
  await assertDriver(tripId, driverId);

  const { data: seatsBefore } = await repo.getTripSeats(tripId);
  const targetSeat = seatsBefore.find(s => s.seat_no === parseInt(seatNo));

  const { error } = await repo.rejectSeat({ tripId, seatNo });
  if (error) throw error;
  await repo.recalcTripAvailableSeats(tripId);

  if (targetSeat && targetSeat.client_id) {
      await notifyUser(targetSeat.client_id, "So'rovingiz rad etildi ❌", "Afsuski, haydovchi buyurtmani qabul qilmadi.", "TRIP_REJECTED", { trip_id: tripId, seat_no: String(seatNo) });
  }
  return await exports.getTripDetails(tripId);
};

// --- DRIVER BLOCK/UNBLOCK ---

exports.blockSeat = async ({ tripId, seatNo, driverId }) => {
  await assertDriver(tripId, driverId);
  const { data: updated, error } = await repo.blockSeatByDriver({ tripId, seatNo });
  if (error) throw error;
  if (!updated) {
     const err = new Error("Seat block qilib bo‘lmadi");
     err.code = "SEAT_NOT_AVAILABLE";
     throw err;
  }
  await repo.recalcTripAvailableSeats(tripId);
  return await exports.getTripDetails(tripId);
};

exports.unblockSeat = async ({ tripId, seatNo, driverId }) => {
  await assertDriver(tripId, driverId);
  const { data: updated, error } = await repo.unblockSeatByDriver({ tripId, seatNo });
  if (error) throw error;
  if (!updated) throw new Error("Seat unblock qilib bo‘lmadi");
  await repo.recalcTripAvailableSeats(tripId);
  return await exports.getTripDetails(tripId);
};