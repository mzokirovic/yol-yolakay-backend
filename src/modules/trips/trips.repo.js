// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/trips/trips.repo.js

const supabase = require('../../core/db/supabase');

// --- Yordamchi funksiya: Keyingi kun sanasi ---
function nextDateISO(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------
// 1. TRIPS (Sayohatlar) CRUD
// ----------------------------------------------------

// Yangi sayohat qo'shish
exports.insertTrip = async (payload) => {
  const { data, error } = await supabase
    .from('trips')
    .insert([payload])
    .select()
    .single();
  return { data, error };
};

// ID orqali olish (Haydovchi profili bilan birga)
exports.getTripById = async (id) => {
  const { data, error } = await supabase
    .from('trips')
    .select('*, driver:profiles(*)') // Haydovchi ma'lumotlarini ulaymiz
    .eq('id', id)
    .single();
  return { data, error };
};

// Qidiruv (Search)
exports.searchTrips = async ({ from, to, date, passengers }) => {
  let query = supabase
    .from('trips')
    .select('*')
    .eq('status', 'active') // Faqat aktivlari
    .order('departure_time', { ascending: true }); // Vaqt bo'yicha

  if (from) query = query.ilike('from_city', `%${from}%`);
  if (to) query = query.ilike('to_city', `%${to}%`);

  const p = passengers ? parseInt(passengers, 10) : 0;
  if (p > 0) query = query.gte('available_seats', p);

  // Sana bo'yicha filter
  if (date) {
    const start = `${date}T00:00:00+05:00`;
    const end = `${nextDateISO(date)}T00:00:00+05:00`;
    query = query.gte('departure_time', start).lt('departure_time', end);
  }

  const { data, error } = await query;
  return { data, error };
};

// Mening sayohatlarim (Haydovchi va Yo'lovchi sifatida)
exports.getUserTrips = async (userId) => {
  // A) Men Haydovchi bo'lganlar
  const { data: driverTrips, error: err1 } = await supabase
    .from('trips')
    .select('*')
    .eq('driver_id', userId)
    .order('departure_time', { ascending: false });

  if (err1) return { error: err1 };

  // B) Men Yo'lovchi bo'lganlar (joy band qilganlarim)
  const { data: mySeats, error: err2 } = await supabase
    .from('trip_seats')
    .select('trip_id')
    .eq('holder_client_id', userId);

  if (err2) return { error: err2 };

  let passengerTrips = [];
  if (mySeats && mySeats.length > 0) {
      const uniqueTripIds = [...new Set(mySeats.map(s => s.trip_id))];
      const { data: found, error: err3 } = await supabase
          .from('trips')
          .select('*')
          .in('id', uniqueTripIds)
          .order('departure_time', { ascending: false });

      if (err3) return { error: err3 };
      passengerTrips = found;
  }

  // Birlashtiramiz va belgilaymiz
  const result = [
      ...driverTrips.map(t => ({ ...t, my_role: 'driver' })),
      ...passengerTrips.map(t => ({ ...t, my_role: 'passenger' }))
  ];

  // Saralash (Eng yangisi tepada)
  const sorted = result.sort((a, b) => new Date(b.departure_time) - new Date(a.departure_time));
  return { data: sorted };
};

// ----------------------------------------------------
// 2. SEATS (O'rindiqlar) MANAGEMENT
// ----------------------------------------------------

exports.getTripSeats = async (tripId) => {
  const { data, error } = await supabase
    .from('trip_seats')
    .select('*')
    .eq('trip_id', tripId)
    .order('seat_no', { ascending: true });
  return { data, error };
};

// Trip yaratilganda o'rindiqlarni boshlang'ich holatga keltirish
exports.initTripSeats = async (tripId, seatsCount) => {
  const seats = [];
  // Har doim 4 ta o'rindiq yaratamiz
  for (let i = 1; i <= 4; i++) {
    // Agar haydovchi 3 ta joy bor desa, 4-o'rindiq 'blocked' bo'ladi
    const status = i <= seatsCount ? 'available' : 'blocked';
    seats.push({
      trip_id: tripId,
      seat_no: i,
      status: status,
      locked_by_driver: false
    });
  }
  const { error } = await supabase.from('trip_seats').insert(seats);
  if (error) console.error("Init seats error:", error);
};

// Available joylarni qayta hisoblash va Trips jadvaliga yozish
exports.recalcTripAvailableSeats = async (tripId) => {
  // 1. Sanash
  const { count, error } = await supabase
    .from('trip_seats')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .eq('status', 'available');

  if (!error) {
    // 2. Yangilash
    await supabase
      .from('trips')
      .update({ available_seats: count })
      .eq('id', tripId);
  }
  return { error };
};

// ----------------------------------------------------
// 3. SEAT ACTIONS (Band qilish, Bekor qilish...)
// ----------------------------------------------------

// Yo'lovchi: Joy so'rash
exports.requestSeat = async ({ tripId, seatNo, clientId, holderName }) => {
  const { data, error } = await supabase
    .from('trip_seats')
    .update({
        status: 'pending',
        holder_client_id: clientId,
        holder_name: holderName || 'Yo\'lovchi'
    })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'available') // Optimistic Lock (Faqat bo'sh bo'lsa)
    .select()
    .maybeSingle();
  return { data, error };
};

// Yo'lovchi: So'rovni bekor qilish
exports.cancelRequest = async ({ tripId, seatNo, clientId }) => {
  const { data, error } = await supabase
    .from('trip_seats')
    .update({ status: 'available', holder_client_id: null, holder_name: null })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'pending')
    .eq('holder_client_id', clientId); // Faqat o'zimnikini
  return { data, error };
};

// Haydovchi: Qabul qilish
exports.approveSeat = async ({ tripId, seatNo }) => {
  const { data, error } = await supabase
    .from('trip_seats')
    .update({ status: 'booked' })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  return { data, error };
};

// Haydovchi: Rad etish
exports.rejectSeat = async ({ tripId, seatNo }) => {
  const { data, error } = await supabase
    .from('trip_seats')
    .update({ status: 'available', holder_client_id: null, holder_name: null })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  return { error };
};

// Haydovchi: Joyni yopish (Block)
exports.blockSeatByDriver = async ({ tripId, seatNo }) => {
  const { data, error } = await supabase
    .from('trip_seats')
    .update({ status: 'blocked', locked_by_driver: true })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'available')
    .select()
    .maybeSingle();
  return { data, error };
};

// Haydovchi: Joyni ochish (Unblock)
exports.unblockSeatByDriver = async ({ tripId, seatNo }) => {
  const { data, error } = await supabase
    .from('trip_seats')
    .update({ status: 'available', locked_by_driver: false })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'blocked')
    .eq('locked_by_driver', true)
    .select()
    .maybeSingle();
  return { data, error };
};


 exports.autoRejectAllPendingSeats = async (tripId) => {
   const { error } = await supabase
     .from('trip_seats')
     .update({ status: 'available', holder_client_id: null, holder_name: null })
     .eq('trip_id', tripId)
     .eq('status', 'pending');
   return { error };
 };

 exports.markTripInProgress = async (tripId) => {
   const { data, error } = await supabase
     .from('trips')
     .update({ status: 'in_progress', started_at: new Date().toISOString() })
     .eq('id', tripId)
     .eq('status', 'active')
     .select()
     .maybeSingle();
   return { data, error };
 };

 exports.markTripFinished = async (tripId) => {
   const { data, error } = await supabase
     .from('trips')
     .update({ status: 'finished', ended_at: new Date().toISOString() })
     .eq('id', tripId)
     .eq('status', 'in_progress')
     .select()
     .maybeSingle();
   return { data, error };
 };
