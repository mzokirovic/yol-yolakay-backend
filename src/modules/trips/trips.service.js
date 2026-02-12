// src/modules/trips/trips.service.js

const repo = require('./trips.repo');
const notifRepo = require('../notifications/notifications.repo');
const pricingService = require('./pricing.service');
const profileService = require('../profile/profile.service');
const supabase = require('../../core/db/supabase'); // ✅ kerak
const { sendToToken } = require('../../core/fcm');

// --- HELPER FUNCTIONS ---

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


function assertTripActive(trip) {
  if (!trip) {
    const err = new Error("Trip topilmadi");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (trip.status !== 'active') {
    const err = new Error("Safar boshlangan yoki tugagan. Joylar endi o‘zgarmaydi.");
    err.code = "INVALID_STATE";
    throw err;
  }
}

// ✅ Faqat YANGI booking (request) uchun: departure_time o'tgan bo'lsa yopamiz
function assertBookingOpen(trip) {
  assertTripActive(trip);

  const dep = trip.departure_time || trip.departureTime;
  if (!dep) return;

  const depMs = new Date(dep).getTime();
  if (Number.isFinite(depMs) && Date.now() >= depMs) {
    const err = new Error("Safar vaqti o‘tib ketgan. Endi yangi bron qilib bo‘lmaydi.");
    err.code = "INVALID_STATE";
    throw err;
  }
}



async function getDriverInfo(userId) {
  const profile = await profileService.getOrCreateProfile(userId);

  if (!profile || !profile.phone) {
    throw new Error("Sayohat yaratish uchun profilingizda telefon raqamini kiriting.");
  }

  const vehicle = await profileService.getVehicle(userId);

  if (!vehicle) {
    throw new Error("Sizda ro'yxatdan o'tgan mashina yo'q. Avval mashina qo'shing.");
  }

  if (!vehicle.model || !vehicle.plate) {
    throw new Error("Mashina ma'lumotlari to'liq emas (Model va Raqam shart).");
  }

  return { profile, vehicle };
}

async function resolveLocation(locationName, pointId, manualLat, manualLng) {
  return {
    name: locationName || "Noma'lum joy",
    lat: Number(manualLat) || 0.0,
    lng: Number(manualLng) || 0.0,
    pointId: pointId || null
  };
}

// -----------------------------------------------------
// ✅ MINIMAL: seat => holder_profile (snake_case) + pending privacy
// -----------------------------------------------------

function pickDisplayName(p) {
  if (!p) return null;
  return (
    p.display_name ||
    p.displayName ||
    p.full_name ||
    p.fullName ||
    [p.first_name, p.last_name].filter(Boolean).join(' ') ||
    p.name ||
    null
  );
}

function pickAvatarUrl(p) {
  if (!p) return null;
  return p.avatar_url || p.avatarUrl || p.photo_url || p.photoUrl || null;
}

function pickRating(p) {
  if (!p) return null;
  const r = p.rating ?? p.stars ?? p.rate ?? null;
  return typeof r === 'number' ? r : null;
}

function canExposeProfile(seat, viewerId, isDriver) {
  if (!seat) return false;
  if (seat.status === 'booked') return true; // ✅ booked: hamma ko‘ra oladi
  if (seat.status === 'pending') {
    if (!viewerId) return false;
    return isDriver || String(seat.holder_client_id) === String(viewerId);
  }
  return false;
}

// holder_client_id ni hamma ko‘rmasin: faqat driver yoki o‘zi
function canExposeHolderId(seat, viewerId, isDriver) {
  if (!seat || !viewerId) return false;
  return isDriver || String(seat.holder_client_id) === String(viewerId);
}

async function loadPublicProfilesMap(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', ids);

  if (error) {
    console.error("profiles load error:", error.message);
    return {};
  }

  const map = {};
  for (const p of data || []) {
    map[p.id] = {
      user_id: p.id,                           // ✅ snake_case
      display_name: pickDisplayName(p),        // ✅ snake_case
      avatar_url: pickAvatarUrl(p),            // ✅ snake_case
      rating: pickRating(p),
    };
  }
  return map;
}

async function enrichSeatsWithHolderProfiles(seatsRaw, trip, viewerId) {
  const driverId = trip?.driver_id ? String(trip.driver_id) : null;
  const isDriver = viewerId && driverId && String(viewerId) === driverId;

  // Faqat ko‘rsatishga ruxsat bo‘lgan seatlar uchun profile yuklaymiz
  const idsToLoad = (seatsRaw || [])
    .filter(s => canExposeProfile(s, viewerId, isDriver))
    .map(s => s.holder_client_id)
    .filter(Boolean);

  const profilesMap = await loadPublicProfilesMap(idsToLoad);

  return (seatsRaw || []).map(s => {
    const exposeProfile = canExposeProfile(s, viewerId, isDriver);
    const exposeId = canExposeHolderId(s, viewerId, isDriver);

    const holderId = s.holder_client_id ? String(s.holder_client_id) : null;
    const profile = (exposeProfile && holderId) ? (profilesMap[holderId] || null) : null;

    return {
      ...s,
      holder_client_id: exposeId ? s.holder_client_id : null,           // ✅ privacy
      holder_name: exposeProfile ? s.holder_name : null,                // ✅ privacy (pending)
      holder_profile: profile                                           // ✅ Android parse qiladi
    };
  });
}

// --- MAIN BUSINESS LOGIC ---

exports.createTrip = async (data, userId) => {
  const { profile, vehicle } = await getDriverInfo(userId);

  const fromLoc = await resolveLocation(data.fromLocation, data.fromPointId, data.fromLat, data.fromLng);
  const toLoc = await resolveLocation(data.toLocation, data.toPointId, data.toLat, data.toLng);

  const departureTime = `${data.date}T${data.time}:00+05:00`;
  if (new Date(departureTime) < new Date()) {
    throw new Error("O'tib ketgan vaqtga e'lon berib bo'lmaydi.");
  }

  const distance = pricingService.calculateDistance(fromLoc.lat, fromLoc.lng, toLoc.lat, toLoc.lng);
  const priceCalc = pricingService.calculateTripPrice(distance);

  const priceCheck = pricingService.validatePrice(data.price, priceCalc);
  if (!priceCheck.valid) {
    throw new Error(priceCheck.message);
  }

  const seatsNum = parseInt(data.seats, 10);
  if (Number.isNaN(seatsNum) || seatsNum < 1 || seatsNum > 4) {
    throw new Error("Seats 1..4 oralig'ida bo'lishi kerak");
  }

  const dbPayload = {
    driver_id: userId,
    driver_name: profile.displayName,
    phone_number: profile.phone,
    car_model: `${vehicle.make} ${vehicle.model} (${vehicle.color})`,

    from_city: fromLoc.name,
    to_city: toLoc.name,
    departure_time: departureTime,

    price: data.price,
    available_seats: seatsNum,
    status: 'active',

    start_lat: fromLoc.lat,
    start_lng: fromLoc.lng,
    end_lat: toLoc.lat,
    end_lng: toLoc.lng,

    meeting_point_id: fromLoc.pointId
  };

  const { data: newTrip, error } = await repo.insertTrip(dbPayload);
  if (error) throw error;

  await repo.initTripSeats(newTrip.id, seatsNum);
  const { error: e2 } = await repo.recalcTripAvailableSeats(newTrip.id);
  if (e2) throw e2;

  newTrip.is_price_low = priceCheck.isLow;
  newTrip.recommended_price = priceCalc.recommended;

  return newTrip;
};

exports.searchTrips = async ({ from, to, date, passengers }) => {
  const { data, error } = await repo.searchTrips({ from, to, date, passengers });
  if (error) throw error;
  return data;
};

exports.getUserTrips = async (userId) => {
  return await repo.getUserTrips(userId);
};

// ✅ viewerId optional (optionalAuth bilan keladi)
exports.getTripDetails = async (tripId, viewerId = null) => {
  const { data: trip, error: e1 } = await repo.getTripById(tripId);
  if (e1) throw e1;

  const { data: seatsRaw, error: e2 } = await repo.getTripSeats(tripId);
  if (e2) throw e2;

  const seats = await enrichSeatsWithHolderProfiles(seatsRaw, trip, viewerId);
  return { trip, seats };
};

// --- SEAT ACTIONS ---

exports.requestSeat = async ({ tripId, seatNo, clientId, holderName }) => {
  const { data: trip, error: eTrip } = await repo.getTripById(tripId);
  if (eTrip) throw eTrip;

  assertBookingOpen(trip);

  if (trip?.driver_id && String(trip.driver_id) === String(clientId)) {
    const err = new Error("Haydovchi o'z safarida joy band qila olmaydi.");
    err.code = "FORBIDDEN";
    throw err;
  }

  const { data: updated, error } = await repo.requestSeat({ tripId, seatNo, clientId, holderName });
  if (error) throw error;

  if (!updated) {
    const err = new Error("Seat available emas");
    err.code = "SEAT_NOT_AVAILABLE";
    throw err;
  }

  await repo.recalcTripAvailableSeats(tripId);

  const result = await exports.getTripDetails(tripId, clientId); // ✅ viewerId
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
  const { data: trip, error: eTrip } = await repo.getTripById(tripId);
  if (eTrip) throw eTrip;

  assertTripActive(trip);

  const { error } = await repo.cancelRequest({ tripId, seatNo, clientId });
  if (error) throw error;

  await repo.recalcTripAvailableSeats(tripId);

  const result = await exports.getTripDetails(tripId, clientId); // ✅ viewerId
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
  const trip = await assertDriver(tripId, driverId); // ✅ trip qaytaradi
  assertTripActive(trip);


  const { data: seatsBefore } = await repo.getTripSeats(tripId);
  const sNo = parseInt(seatNo, 10);
  const targetSeat = seatsBefore?.find(s => s.seat_no === sNo);

  const { data: updated, error } = await repo.approveSeat({ tripId, seatNo });
  if (error) throw error;

  if (!updated) {
    const err = new Error("Approve bo‘lmadi");
    err.code = "SEAT_NOT_AVAILABLE";
    throw err;
  }

  await repo.recalcTripAvailableSeats(tripId);

  if (targetSeat && targetSeat.holder_client_id) {
    await notifyUser(
      targetSeat.holder_client_id,
      "So'rovingiz qabul qilindi! ✅",
      "Haydovchi buyurtmangizni tasdiqladi.",
      "TRIP_APPROVED",
      { trip_id: tripId, seat_no: String(seatNo) }
    );
  }

  return await exports.getTripDetails(tripId, driverId);
};


exports.rejectSeat = async ({ tripId, seatNo, driverId }) => {
  const trip = await assertDriver(tripId, driverId);
  assertTripActive(trip);


  const { data: seatsBefore } = await repo.getTripSeats(tripId);
  const sNo = parseInt(seatNo, 10);
  const targetSeat = seatsBefore?.find(s => s.seat_no === sNo);

  const { data: updated, error } = await repo.rejectSeat({ tripId, seatNo });
  if (error) throw error;

  await repo.recalcTripAvailableSeats(tripId);

  if (targetSeat && targetSeat.holder_client_id) {
    await notifyUser(
      targetSeat.holder_client_id,
      "So'rovingiz rad etildi ❌",
      "Afsuski, haydovchi buyurtmani qabul qilmadi.",
      "TRIP_REJECTED",
      { trip_id: tripId, seat_no: String(seatNo) }
    );
  }

  return await exports.getTripDetails(tripId, driverId);
};


exports.blockSeat = async ({ tripId, seatNo, driverId }) => {
  const trip = await assertDriver(tripId, driverId);
  assertTripActive(trip);


  const { data: updated, error } = await repo.blockSeatByDriver({ tripId, seatNo });
  if (error) throw error;

  if (!updated) {
    const err = new Error("Seat block qilib bo‘lmadi");
    err.code = "SEAT_NOT_AVAILABLE";
    throw err;
  }

  await repo.recalcTripAvailableSeats(tripId);
  return await exports.getTripDetails(tripId, driverId);
};


exports.unblockSeat = async ({ tripId, seatNo, driverId }) => {
  const trip = await assertDriver(tripId, driverId);
  assertTripActive(trip);


  const { data: updated, error } = await repo.unblockSeatByDriver({ tripId, seatNo });
  if (error) throw error;

  if (!updated) {
    const err = new Error("Seat unblock qilib bo‘lmadi");
    err.code = "SEAT_NOT_AVAILABLE";
    throw err;
  }

  await repo.recalcTripAvailableSeats(tripId);
  return await exports.getTripDetails(tripId, driverId);
};



exports.startTrip = async ({ tripId, driverId }) => {
  const trip = await assertDriver(tripId, driverId);

  if (trip.status !== 'active') {
    const err = new Error("Safar allaqachon boshlangan yoki tugagan.");
    err.code = "INVALID_STATE";
    throw err;
  }

  // ✅ 1) Vaqt tekshiruvi: departure_time kelmasdan start bo‘lmasin
  const dep = trip.departure_time || trip.departureTime;
  if (dep) {
    const depMs = new Date(dep).getTime();
    if (Number.isFinite(depMs) && Date.now() < depMs) {
      const err = new Error("Safar vaqti hali kelmagan. Belgilangan vaqtda boshlang.");
      err.code = "INVALID_STATE";
      throw err;
    }
  }

  // ✅ 2) Avval trip statusni in_progress qilamiz (race condition kamayadi)
  const { data: started, error: eStart } = await repo.markTripInProgress(tripId);
  if (eStart) throw eStart;
  if (!started) {
    const err = new Error("Trip status o'zgarmadi (active emas).");
    err.code = "INVALID_STATE";
    throw err;
  }

  // ✅ 3) pending’larni avto reject (MVP)
  const { error: eRej } = await repo.autoRejectAllPendingSeats(tripId);
  if (eRej) throw eRej;

  // ✅ 4) Start paytida qolgan available seatlar lock bo‘lsin (blocked)
  const { error: eLock } = await repo.lockAllAvailableSeatsOnStart(tripId);
  if (eLock) throw eLock;

  // ✅ 5) available_seats qayta hisob (endi 0 bo‘ladi)
  const { error: eRecalc } = await repo.recalcTripAvailableSeats(tripId);
  if (eRecalc) throw eRecalc;

  return await exports.getTripDetails(tripId, driverId);
};



exports.finishTrip = async ({ tripId, driverId }) => {
  const trip = await assertDriver(tripId, driverId);

  if (trip.status !== 'in_progress') {
    const err = new Error("Safar hali boshlanmagan yoki allaqachon tugagan.");
    err.code = "INVALID_STATE";
    throw err;
  }

  const { data, error } = await repo.markTripFinished(tripId);
  if (error) throw error;
  if (!data) {
    const err = new Error("Trip status o'zgarmadi (in_progress emas).");
    err.code = "INVALID_STATE";
    throw err;
  }


  return await exports.getTripDetails(tripId, driverId);
};

