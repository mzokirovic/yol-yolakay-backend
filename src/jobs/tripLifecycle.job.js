// src/jobs/tripLifecycleJob.js
const supabase = require('../core/db/supabase');
const repo = require('../modules/trips/trips.repo');

function intEnv(name, def) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : def;
}

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;

  try {
    const now = Date.now();

    // ---- AUTO START ----
    const START_GRACE_MIN = intEnv('AUTO_START_GRACE_MINUTES', 15);
    const START_MAX_AGE_H = intEnv('AUTO_START_MAX_AGE_HOURS', 24);

    const startEligibleBefore = new Date(now - START_GRACE_MIN * 60_000).toISOString();
    const startNotOlderThan = new Date(now - START_MAX_AGE_H * 3600_000).toISOString();

    const { data: startTrips, error: eStartList } = await supabase
      .from('trips')
      .select('id, status, departure_time')
      .eq('status', 'active')
      .lte('departure_time', startEligibleBefore)
      .gte('departure_time', startNotOlderThan)
      .order('departure_time', { ascending: true })
      .limit(50);

    if (eStartList) {
      console.error('AUTO_START list error:', eStartList.message);
    } else {
      for (const t of startTrips || []) {
        // idempotent / race-safe: markTripInProgress faqat status=active bo‘lsa update qiladi
        const { data: started, error: eMark } = await repo.markTripInProgress(t.id);
        if (eMark) {
          console.error('AUTO_START mark error:', t.id, eMark.message);
          continue;
        }
        if (!started) continue; // boshqa instance boshlab yuborgan bo‘lishi mumkin

        const { error: eRej } = await repo.autoRejectAllPendingSeats(t.id);
        if (eRej) console.error('AUTO_START reject pending error:', t.id, eRej.message);

        const { error: eLock } = await repo.lockAllAvailableSeatsOnStart(t.id);
        if (eLock) console.error('AUTO_START lock seats error:', t.id, eLock.message);

        const { error: eRecalc } = await repo.recalcTripAvailableSeats(t.id);
        if (eRecalc) console.error('AUTO_START recalc error:', t.id, eRecalc.message);

        console.log('✅ AUTO_START done:', t.id);
      }
    }

    // ---- AUTO FINISH ----
    const FINISH_MAX_AGE_H = intEnv('AUTO_FINISH_MAX_AGE_HOURS', 48);
    const finishBefore = new Date(now - FINISH_MAX_AGE_H * 3600_000).toISOString();

    const { data: finishTrips, error: eFinishList } = await supabase
      .from('trips')
      .select('id, status, started_at')
      .eq('status', 'in_progress')
      .lte('started_at', finishBefore)
      .order('started_at', { ascending: true })
      .limit(50);

    if (eFinishList) {
      console.error('AUTO_FINISH list error:', eFinishList.message);
    } else {
      for (const t of finishTrips || []) {
        const { data: fin, error: eFin } = await repo.markTripFinished(t.id);
        if (eFin) {
          console.error('AUTO_FINISH mark error:', t.id, eFin.message);
          continue;
        }
        if (!fin) continue; // race-safe

        console.log('✅ AUTO_FINISH done:', t.id);
      }
    }
  } catch (e) {
    console.error('tripLifecycle tick fatal:', e);
  } finally {
    running = false;
  }
}

exports.start = function start() {
  if (timer) return;

  const intervalSec = intEnv('AUTO_START_INTERVAL_SECONDS', 60);
  const finishIntervalSec = intEnv('AUTO_FINISH_INTERVAL_SECONDS', 60);

  // Ikkalasidan eng kichigida ishlaymiz (bitta timer yetadi)
  const interval = Math.max(5, Math.min(intervalSec, finishIntervalSec)) * 1000;

  console.log('🕒 tripLifecycleJob started. interval(ms)=', interval);

  // darrov bir marta ishga tushsin
  tick().catch(() => {});
  timer = setInterval(() => tick().catch(() => {}), interval);
};

exports.stop = function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  console.log('🛑 tripLifecycleJob stopped.');
};
