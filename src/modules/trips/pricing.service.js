// src/modules/trips/pricing.service.js

// Yerni radiusi (km)
const R = 6371;

// Haversine formulasi: Ikkita koordinata orasidagi masofani (km) hisoblash
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;

  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return parseFloat(distance.toFixed(1)); // 12.5 km formatda
}

/**
 * Narx tavsiyasi va chegaralari
 * @param {number} distanceKm - Masofa
 * @returns {object} { recommended, min, max, warningMsg }
 */
exports.calculateTripPrice = (distanceKm) => {
  // --- SOZLAMALAR (O'zbekiston bozori uchun) ---
  const BASE_PRICE = 5000;      // O'tirish haqqi (Start)
  const PRICE_PER_KM = 350;     // 1 km yo'l haqqi (Metan/Benzin hisobi)
  const MIN_TRIP_PRICE = 5000;  // Eng minimal safar narxi

  // 1. Xom narxni hisoblash
  let rawPrice = BASE_PRICE + (distanceKm * PRICE_PER_KM);

  // 2. Yaxlitlash (Har 1000 so'mga)
  // Masalan: 42,300 -> 42,000; 42,600 -> 43,000
  let recommended = Math.round(rawPrice / 1000) * 1000;

  if (recommended < MIN_TRIP_PRICE) recommended = MIN_TRIP_PRICE;

  // 3. Chegaralar (Validatsiya uchun)
  // Min: Tavsiya etilgandan 50% arzon (undan kami zarar)
  const min = Math.max(MIN_TRIP_PRICE, Math.floor((recommended * 0.5) / 1000) * 1000);

  // Max: Tavsiya etilgandan 3 barobar qimmat (undan qimmati insofsizlik)
  const max = Math.ceil((recommended * 3.0) / 1000) * 1000;

  return {
    distanceKm: Math.round(distanceKm),
    recommended,
    min,
    max
  };
};

exports.validatePrice = (userPrice, calculated) => {
    if (userPrice < calculated.min) {
        return { valid: false, message: `Narx juda arzon. Eng kamida ${calculated.min} so'm bo'lishi kerak.` };
    }
    if (userPrice > calculated.max) {
        return { valid: false, message: `Narx juda qimmat. Maksimal ${calculated.max} so'm bo'lishi mumkin.` };
    }
    const isLow = userPrice < calculated.recommended * 0.7;
    return { valid: true, isLow, message: null };
};

// Controllerda ishlatish uchun export qilamiz
exports.calculateDistance = calculateDistance;