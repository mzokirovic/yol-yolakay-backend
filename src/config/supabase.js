require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Service Role Key bo'lsa zo'r

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;