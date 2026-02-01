require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 1. O'zgaruvchilarni olamiz
const supabaseUrl = process.env.SUPABASE_URL;

// Aqlli tanlov: Renderdagi ANON keyni ham, oddiy KEYni ham qabul qiladi
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

// 2. Agar kalitlar yo'q bo'lsa - Server ishlamasin (Xavfsizlik)
if (!supabaseUrl || !supabaseKey) {
    throw new Error('❌ Supabase URL yoki API Key topilmadi! .env faylni yoki Render Environmentni tekshiring.');
}

// 3. Ulanish
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;