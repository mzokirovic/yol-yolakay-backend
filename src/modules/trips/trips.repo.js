// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/trips/trips.repo.js

const supabase = require('../../core/db/supabase');

function nextDateISO(dateStr /* YYYY-MM-DD */) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- TRIPS ----------
exports.insertTrip = async (dbPayload) => {
  return await supabase
    .from('trips')
    .insert([dbPayload])
    .select()
    .single();
};

exports.searchTrips = async ({ from, to, date, passengers }) => {
  let query = supabase
    .from('trips')
    .select('*')
    .eq('status', 'active')
    .order('departure_time', { ascending: true });

  if (from) query = query.ilike('from_city', `%${from}%`);
  if (to) query = query.ilike('to_city', `%${to}%`);

  const p = passengers != null ? parseInt(passengers, 10) : null;
  if (p && !Number.isNaN(p)) query = query.gte('available_seats', p);

  if (date) {
    const start = `${date}T00:00:00+05:00`;
    const end = `${nextDateISO(date)}T00:00:00+05:00`;
    query = query.gte('departure_time', start).lt('departure_time', end);
  }

  return await query;
};

// ✅ YANGI: User ID bo'yicha Haydovchi va Yo'lovchi e'lonlarini olish
exports.getUserTrips = async (userId) => {
  // A) Men Haydovchi bo'lgan sayohatlar
  const { data: driverTrips, error: err1 } = await supabase
    .from('trips')
    .select('*')
    .eq('driver_id', userId)
    .order('departure_time', { ascending: false });

  if (err1) throw err1;

  // B) Men Yo'lovchi bo'lgan (joy band qilgan) sayohatlar
  // 1. Avval trip_seats dan men band qilgan trip_id larni olamiz
  const { data: mySeats, error: err2 } = await supabase
    .from('trip_seats')
    .select('trip_id')
    .eq('holder_client_id', userId); // Men band qilganman

  if (err2) throw err2;

  let passengerTrips = [];
  if (mySeats && mySeats.length > 0) {
      // Set orqali unikal ID larni ajratamiz (bitta tripda 2 ta joy olgan bo'lsam ham 1 marta chiqsin)
      const tripIds = [...new Set(mySeats.map(s => s.trip_id))];

      // 2. O'sha trip_id lar bo'yicha sayohatlarni olib kelamiz
      const { data: foundTrips, error: err3 } = await supabase
          .from('trips')
          .select('*')
          .in('id', tripIds)
          .order('departure_time', { ascending: false });
      
      if (err3) throw err3;
      passengerTrips = foundTrips;
  }

  // C) Ikkala ro'yxatni birlashtiramiz va belgilab qo'yamiz
  // Frontend bilishi kerak: qaysi birida men haydovchi, qaysi birida yo'lovchi.
  const result = [
      ...driverTrips.map(t => ({ ...t, my_role: 'driver' })),
      ...passengerTrips.map(t => ({ ...t, my_role: 'passenger' }))
  ];

  // Sanaga qarab saralash (eng yangisi tepada)
  return result.sort((a, b) => new Date(b.departure_time) - new Date(a.departure_time));
};

exports.getTripById = async (tripId) => {
  return await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();
};

exports.updateTripAvailableSeats = async (tripId, availableSeats) => {
  return await supabase
    .from('trips')
    .update({ available_seats: availableSeats })
    .eq('id', tripId)
    .select('available_seats')
    .single();
};

// ---------- SEATS ----------
exports.getTripSeats = async (tripId) => {
  return await supabase
    .from('trip_seats')
    .select('*')
    .eq('trip_id', tripId)
    .order('seat_no', { ascending: true });
};

// ✅ Trip yaratilganda: 4 ta seat bo‘ladi,
// seatsOffered ta seat RANDOM available, qolganlari blocked (system-closed: locked_by_driver=false)
exports.initTripSeats = async (tripId, seatsOffered) => {
  const all = [1, 2, 3, 4];
  const open = new Set(shuffle(all).slice(0, seatsOffered));

  const rows = all.map((n) => ({
    trip_id: tripId,
    seat_no: n,
    status: open.has(n) ? 'available' : 'blocked',
    locked_by_driver: false, // system-closed
    holder_name: null,
    holder_client_id: null,
  }));

  return await supabase.from('trip_seats').insert(rows);
};

// ✅ available seatlar sonini seat table’dan hisoblaymiz
exports.recalcTripAvailableSeats = async (tripId) => {
  const { data, error } = await supabase
    .from('trip_seats')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .eq('status', 'available');

  if (error) return { data: null, error };
  const count = data?.length ? data.length : 0; // head:true bo‘lsa length 0 bo‘lishi mumkin

  // Supabase head:true bilan count alohida qaytadi, lekin clientlarda farq bo‘lishi mumkin.
  // Shuning uchun count’ni xavfsiz olish:
  const availableSeats = (typeof data === 'object' && data !== null && 'count' in data)
    ? data.count
    : undefined;

  // Agar count kelmasa, fallback: yana bir marta oddiy select qilib sanaymiz
  if (availableSeats == null) {
    const r = await supabase
      .from('trip_seats')
      .select('id')
      .eq('trip_id', tripId)
      .eq('status', 'available');
    if (r.error) return { data: null, error: r.error };
    const c = (r.data || []).length;
    return await exports.updateTripAvailableSeats(tripId, c);
  }

  return await exports.updateTripAvailableSeats(tripId, availableSeats);
};

// Passenger: available -> pending (atomik)
exports.requestSeat = async ({ tripId, seatNo, holderName, clientId }) => {
  return await supabase
    .from('trip_seats')
    .update({
      status: 'pending',
      holder_name: holderName ?? 'Passenger',
      holder_client_id: clientId,
    })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'available')
    .select()
    .maybeSingle();
};

// Driver: pending -> booked (atomik)
exports.approveSeat = async ({ tripId, seatNo }) => {
  return await supabase
    .from('trip_seats')
    .update({ status: 'booked' })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
};

// Driver: pending -> available (atomik) + holder null
exports.rejectSeat = async ({ tripId, seatNo }) => {
  return await supabase
    .from('trip_seats')
    .update({
      status: 'available',
      holder_name: null,
      holder_client_id: null,
    })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
};

// Passenger: pending(mine) -> available (atomik)
exports.cancelRequest = async ({ tripId, seatNo, clientId }) => {
  return await supabase
    .from('trip_seats')
    .update({
      status: 'available',
      holder_name: null,
      holder_client_id: null,
    })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'pending')
    .eq('holder_client_id', clientId)
    .select()
    .maybeSingle();
};

// Driver: available -> blocked (atomik, locked_by_driver=true)
exports.blockSeatByDriver = async ({ tripId, seatNo }) => {
  return await supabase
    .from('trip_seats')
    .update({ status: 'blocked', locked_by_driver: true })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'available')
    .select()
    .maybeSingle();
};

// Driver: blocked(driver) -> available
exports.unblockSeatByDriver = async ({ tripId, seatNo }) => {
  return await supabase
    .from('trip_seats')
    .update({ status: 'available', locked_by_driver: false })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'blocked')
    .select()
    .maybeSingle();
};