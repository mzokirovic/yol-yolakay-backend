const supabase = require('../../core/db/supabase');

function nextDateISO(dateStr /* YYYY-MM-DD */) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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

  // passengers: available_seats >= passengers
  const p = passengers != null ? parseInt(passengers, 10) : null;
  if (p && !Number.isNaN(p)) query = query.gte('available_seats', p);

  // date: faqat o‘sha kun oralig‘i (>= start, < next day)
  if (date) {
    const start = `${date}T00:00:00+05:00`;
    const end = `${nextDateISO(date)}T00:00:00+05:00`;
    query = query.gte('departure_time', start).lt('departure_time', end);
  }

  return await query;
};

exports.getMyTrips = async ({ driverName }) => {
  let query = supabase
    .from('trips')
    .select('*')
    .order('departure_time', { ascending: false });

  if (driverName) query = query.eq('driver_name', driverName);

  return await query;
};

exports.getTripById = async (tripId) => {
  return await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
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

// Trip yaratilganda 1..4 seat qatorlarini create qiladi.
// seatsOffered = trips.available_seats (1..4)
exports.initTripSeats = async (tripId, seatsOffered) => {
  const rows = [1, 2, 3, 4].map((n) => ({
    trip_id: tripId,
    seat_no: n,
    status: n <= seatsOffered ? 'available' : 'blocked',
  }));

  // unique constraint bor, agar takror insert bo‘lsa error beradi (normal)
  return await supabase
    .from('trip_seats')
    .insert(rows);
};

// Seatni "available" bo'lsa "booked" qiladi.
// ✅ maybeSingle() bilan: agar 0 row bo‘lsa error emas, data=null bo‘ladi
exports.bookSeat = async ({ tripId, seatNo, holderName, clientId }) => {
  return await supabase
    .from('trip_seats')
    .update({
      status: 'booked',
      holder_name: holderName ?? 'Passenger',
      holder_client_id: clientId,
    })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'available')
    .select()
    .maybeSingle();
};

// trips.available_seats ni -1 qilish (MVP)
exports.decrementTripAvailableSeats = async (tripId) => {
  const { data: trip, error: e1 } = await supabase
    .from('trips')
    .select('available_seats')
    .eq('id', tripId)
    .single();

  if (e1) return { data: null, error: e1 };

  const next = Math.max(0, (trip.available_seats ?? 0) - 1);

  return await supabase
    .from('trips')
    .update({ available_seats: next })
    .eq('id', tripId)
    .select('available_seats')
    .single();
};

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

exports.unblockSeatByDriver = async ({ tripId, seatNo }) => {
  return await supabase
    .from('trip_seats')
    .update({ status: 'available', locked_by_driver: false })
    .eq('trip_id', tripId)
    .eq('seat_no', seatNo)
    .eq('status', 'blocked')
    .eq('locked_by_driver', true)
    .select()
    .maybeSingle();
};

exports.incrementTripAvailableSeats = async (tripId) => {
  const { data: trip, error: e1 } = await supabase
    .from('trips')
    .select('available_seats')
    .eq('id', tripId)
    .single();
  if (e1) return { data: null, error: e1 };

  const next = Math.min(4, (trip.available_seats ?? 0) + 1);

  return await supabase
    .from('trips')
    .update({ available_seats: next })
    .eq('id', tripId)
    .select('available_seats')
    .single();
};
