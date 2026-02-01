const supabase = require('../../core/db/supabase');

function nextDateISO(dateStr /* YYYY-MM-DD */) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

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
