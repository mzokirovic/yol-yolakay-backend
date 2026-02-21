// src/jobs/backfillRouteMeta.job.js
const supabase = require('../core/db/supabase');
const routingService = require('../modules/routing/routing.service');

async function backfill(limit = 200) {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, start_lat, start_lng, end_lat, end_lng, distance_km, duration_min')
    .or('distance_km.is.null,duration_min.is.null')
    .limit(limit);

  if (error) throw error;
  if (!trips?.length) {
    console.log('✅ Nothing to backfill');
    return;
  }

  let ok = 0;
  for (const t of trips) {
    const { id, start_lat, start_lng, end_lat, end_lng } = t;

    if (
      start_lat == null || start_lng == null ||
      end_lat == null || end_lng == null ||
      (Number(start_lat) === 0 && Number(start_lng) === 0) ||
      (Number(end_lat) === 0 && Number(end_lng) === 0)
    ) {
      continue;
    }

    const { distanceKm, durationMin } = routingService.computeRouteMeta({
      fromLat: Number(start_lat),
      fromLng: Number(start_lng),
      toLat: Number(end_lat),
      toLng: Number(end_lng),
    });

    const { error: e2 } = await supabase
      .from('trips')
      .update({ distance_km: distanceKm, duration_min: durationMin })
      .eq('id', id);

    if (!e2) ok++;
  }

  console.log(`✅ Backfill done: ${ok}/${trips.length}`);
}

if (require.main === module) {
  backfill(500).catch((e) => {
    console.error('❌ Backfill error:', e);
    process.exit(1);
  });
}

module.exports = { backfill };