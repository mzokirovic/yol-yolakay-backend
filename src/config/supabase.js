require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// O'zgaruvchilarni olamiz
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// --- 🕵️‍♂️ DETEKTIV LOGLAR ---
console.log("==========================================");
console.log("🔍 DIAGNOSTIKA:");
// Agar 'undefined' bo'lsa "YO'Q" deydi, agar bo'lsa uzunligini aytadi
console.log(`1. SUPABASE_URL: ${supabaseUrl ? "✅ BOR" : "❌ YO'Q"} (Uzunligi: ${supabaseUrl ? supabaseUrl.length : 0})`);
console.log(`2. SUPABASE_KEY: ${supabaseKey ? "✅ BOR" : "❌ YO'Q"} (Uzunligi: ${supabaseKey ? supabaseKey.length : 0})`);
console.log("==========================================");

// --- 🛡 XAVFSIZLIK CHORASI ---
// Agar kalitlar yo'q bo'lsa, server qulamasligi uchun SOXTA qiymat beramiz.
// Bu faqat loglarni ko'rib olishimiz uchun kerak.
const finalUrl = supabaseUrl || "https://example.supabase.co";
const finalKey = supabaseKey || "soxta-kalit-faqat-test-uchun";

if (!supabaseUrl || !supabaseKey) {
    console.error("⚠️ DIQQAT: Render Environmentda kalitlar topilmadi! Soxta kalitlar ishlatilyapti.");
}

const supabase = createClient(finalUrl, finalKey);

module.exports = supabase;