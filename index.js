const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Supabase ulanishi
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// 1. Safarlarni olish va QIDIRISH (GET)
app.get('/api/trips', async (req, res) => {
    // Androiddan keladigan qidiruv parametrlarini olamiz
    const { from, to } = req.query; 

    try {
        let query = supabase
            .from('trips')
            .select('*')
            .order('created_at', { ascending: false });

        // Agar "from" (qayerdan) yozilgan bo'lsa, filtr qo'shamiz
        if (from) {
            query = query.ilike('from_city', `%${from}%`);
        }
        
        // Agar "to" (qayerga) yozilgan bo'lsa, filtr qo'shamiz
        if (to) {
            query = query.ilike('to_city', `%${to}%`);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Yangi safar qo'shish (POST)
app.post('/api/trips', async (req, res) => {
    const { 
        driver_name, from_city, to_city, 
        departure_time, price, available_seats, car_model 
    } = req.body;

    try {
        const { data, error } = await supabase
            .from('trips')
            .insert([{ 
                driver_name, from_city, to_city, 
                departure_time, price, available_seats, car_model 
            }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serverni ishga tushirish
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ${PORT}-portda ishga tushdi!`);
});
