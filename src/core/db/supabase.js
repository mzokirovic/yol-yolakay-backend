require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("❌ Supabase URL yoki API Key topilmadi! .env/Render Env tekshiring.");
}

const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = supabase;
