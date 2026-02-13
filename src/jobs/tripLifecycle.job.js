// src/jobs/tripLifecycle.job.js
const supabase = require('../core/db/supabase');
const repo = require('../modules/trips/trips.repo');

// ✅ Real app notifications: DB + push
const notificationsService = require('../modules/notifications/notifications.service');

function intEnv(name, def) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : def;
}

let timer = null;
let running = false;

// ✅ Helper: trip event -> driver + booked passengers
async function notifyTripEvent({
  tripId,
  driverId,
  type,
  driverTitle,
  driverBody,
  passengerTitle,
  passengerBody,
}) {
  try {
    const tId = String(tripId || '');
    if (!tId) return;

    const dataPayload = { trip_id: tId };

    // 1) Driver
    const dId = driverId ? String(driverId) : null;
    if (dId) {
      await notificationsService.createAndPush(
        dId,
        driverTitle || '',
        driverBody || '',
        type,
        dataPayload
      );
    }

    // 2) Booked passengers (trip_seats)
    const { data: seats, error: eSeats } = await repo.getTripSeats(tripId);
    if (eSeats) {
      console.error('TRIP_EVENT seats load error:', tripId, eSeats.message || eSeats);
      return;
    }

    const passengerIds = [
      ...new Set(
        (seats || [])
          .filter(s => s.status === 'booked' && s.holder_client_id)
          .map(s => String(s.holder_client_id))
      ),
    ];

    // Driverga qayta yubormaslik (xavfsizlik)
    const filtered = dId ? passengerIds.filter(id => id !== dId) : passengerIds;
    if (!filtered.length) return;

    const pTitle = passengerTitle || driverTitle || '';
    const pBody = passengerBody || driverBody || '';

    // parallel, lekin yiqilmasin
    const results = await Promise.allSettled(
      filtered.map(uid =>
        notificationsService.createAndPush(uid, pTitle, pBody, type, dataPayload)
      )
    );

    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    if (fail > 0) {
      console.error('TRIP_EVENT notify passengers partial fail:', { tripId, ok, fail });
    }
  } catch (e) {
    console.error('TRIP_EVENT notify fatal:', tripId, e?.message || e);
  }
}

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
      .select('id, status, departure_time, driver_id')
      .eq('status', 'active')
      .lte('departure_time', startEligibleBefore)
      .gte('departure_time', startNotOlderThan)
      .order('departure_time', { ascending: true })
      .limit(50);

    if (eStartList) {
      console.error('AUTO_START list error:', eStartList.message || eStartList);
    } else {
      for (const t of startTrips || []) {
        // idempotent / race-safe: markTripInProgress faqat status=active bo‘lsa update qiladi
        const { data: started, error: eMark } = await repo.markTripInProgress(t.id);
        if (eMark) {
          console.error('AUTO_START mark error:', t.id, eMark.message || eMark);
          continue;
        }
        if (!started) continue; // boshqa instance boshlab yuborgan bo‘lishi mumkin

        const { error: eRej } = await repo.autoRejectAllPendingSeats(t.id);
        if (eRej) console.error('AUTO_START reject pending error:', t.id, eRej.message || eRej);

        const { error: eLock } = await repo.lockAllAvailableSeatsOnStart(t.id);
        if (eLock) console.error('AUTO_START lock seats error:', t.id, eLock.message || eLock);

        const { error: eRecalc } = await repo.recalcTripAvailableSeats(t.id);
        if (eRecalc) console.error('AUTO_START recalc error:', t.id, eRecalc.message || eRecalc);

        // ✅ Notification: DB + push (driver + booked passengers)
        await notifyTripEvent({
          tripId: t.id,
          driverId: started?.driver_id || t.driver_id,
          type: 'TRIP_STARTED',
          driverTitle: 'Safar boshlandi 🚗',
          driverBody: 'Safaringiz avtomatik boshlandi.',
          passengerTitle: 'Safar boshlandi 🚗',
          passengerBody: 'Siz band qilgan safar boshlandi.',
        });

        console.log('✅ AUTO_START done:', t.id);
      }
    }

    // ---- AUTO FINISH ----
    const FINISH_MAX_AGE_H = intEnv('AUTO_FINISH_MAX_AGE_HOURS', 48);
    const finishBefore = new Date(now - FINISH_MAX_AGE_H * 3600_000).toISOString();

    const { data: finishTrips, error: eFinishList } = await supabase
      .from('trips')
      .select('id, status, started_at, driver_id')
      .eq('status', 'in_progress')
      .lte('started_at', finishBefore)
      .order('started_at', { ascending: true })
      .limit(50);

    if (eFinishList) {
      console.error('AUTO_FINISH list error:', eFinishList.message || eFinishList);
    } else {
      for (const t of finishTrips || []) {
        const { data: fin, error: eFin } = await repo.markTripFinished(t.id);
        if (eFin) {
          console.error('AUTO_FINISH mark error:', t.id, eFin.message || eFin);
          continue;
        }
        if (!fin) continue; // race-safe

        // ✅ Notification: DB + push (driver + booked passengers)
        await notifyTripEvent({
          tripId: t.id,
          driverId: fin?.driver_id || t.driver_id,
          type: 'TRIP_FINISHED',
          driverTitle: 'Safar tugadi ✅',
          driverBody: 'Safaringiz avtomatik yakunlandi.',
          passengerTitle: 'Safar tugadi ✅',
          passengerBody: 'Siz qatnashgan safar yakunlandi.',
        });

        console.log('✅ AUTO_FINISH done:', t.id);
      }
    }
  } catch (e) {
    console.error('tripLifecycle tick fatal:', e?.message || e);
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

  tick().catch(() => {});
  timer = setInterval(() => tick().catch(() => {}), interval);
};

exports.stop = function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  console.log('🛑 tripLifecycleJob stopped.');
};
