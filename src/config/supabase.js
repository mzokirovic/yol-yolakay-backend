require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ XATO: SUPABASE_URL yoki SUPABASE_KEY topilmadi! Render Environmentni tekshiring.");
    // Serverni to'xtatmaymiz, lekin logda qizil bo'lib chiqadi
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;