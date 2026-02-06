// src/modules/trips/pricing.service.js

// Yerni radiusi (km)
const R = 6371; 

// Haversine formulasi: Ikkita koordinata orasidagi masofani (km) hisoblash
function calculateDistance(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Narx tavsiyasi va chegaralari
 * @param {number} distanceKm - Masofa
 * @returns {object} { recommended, min, max, warningMsg }
 */
exports.calculateTripPrice = (distanceKm) => {
  // O'zbekiston sharoiti uchun (taxminiy): 
  // 1 km = 350 so'm (o'rtacha)
  // Bazaviy narx = 5000 so'm (o'tirish haqqi kabi)
  
  const BASE_PRICE = 5000;
  const PRICE_PER_KM = 350;

  // Tavsiya etilgan narx (yaxlitlash 1000 so'mga)
  let recommended = BASE_PRICE + (distanceKm * PRICE_PER_KM);
  recommended = Math.ceil(recommended / 1000) * 1000;

  // Chegaralar (Blablacar logikasi: juda qimmat yoki tekin bo'lmasligi kerak)
  const min = Math.max(5000, recommended * 0.5); // Tavsiya etilgandan 50% arzon bo'lishi mumkin emas
  const max = recommended * 3.0; // 3 barobar qimmat bo'lishi mumkin emas

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
    // Agar narx tavsiya etilgandan 50% past bo'lsa, ogohlantirish (lekin ruxsat beramiz)
    const isLow = userPrice < calculated.recommended * 0.7;
    
    return { valid: true, isLow, message: null };
};
