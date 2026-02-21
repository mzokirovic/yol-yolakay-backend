// src/modules/routing/routing.service.js

const R = 6371;
const ROAD_FACTOR = 1.25;

function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;

  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function effectiveDistanceKm(lineKm) {
  const km = Math.max(0, Number(lineKm) || 0);
  if (km <= 0) return 0;
  return Math.max(1, Math.round(km * ROAD_FACTOR));
}

function estimateDurationMinutes(distanceKm) {
  const km = Math.max(0, Number(distanceKm) || 0);
  if (km <= 0) return 0;

  let speed;
  if (km <= 15) speed = 25;
  else if (km <= 60) speed = 45;
  else if (km <= 200) speed = 70;
  else speed = 85;

  const base = (km / speed) * 60;
  const buffer = 10 + Math.floor(km / 50) * 5;
  return Math.max(1, Math.round(base + buffer));
}

exports.computeRouteMeta = ({ fromLat, fromLng, toLat, toLng }) => {
  const lineKm = haversineKm(fromLat, fromLng, toLat, toLng);
  const distanceKm = effectiveDistanceKm(lineKm);
  const durationMin = estimateDurationMinutes(distanceKm);

  return {
    distanceKm,
    durationMin,
    // debug uchun kerak bo‘lsa:
    lineKm: Number(lineKm.toFixed(1))
  };
};