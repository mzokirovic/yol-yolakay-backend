const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// 1. Safarlarni olish va QIDIRISH (GET)
app.get('/api/trips', async (req, res) => {
    const { from, to } = req.query; 

    try {
        let query = supabase
            .from('trips')
            .select('*')
            .order('created_at', { ascending: false });

        if (from) {
            query = query.ilike('from_city', `%${from}%`);
        }
        
        if (to) {
            query = query.ilike('to_city', `%${to}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        // ✅ SENIOR QISMI: Android TripDto modeliga moslab qaytaramiz
        // Bu mapping Android tomonda crash bo'lishini oldini oladi
        const formattedData = data.map(t => ({
            id: t.id,
            start_point: t.from_city,  // Android start_point kutmoqda
            end_point: t.to_city,      // Android end_point kutmoqda
            trip_date: t.departure_time,
            available_seats: t.available_seats,
            price: t.price,
            driver_name: t.driver_name,
            car_model: t.car_model
        }));

        res.json(formattedData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Yangi safar qo'shish (POST)
app.post('/api/trips', async (req, res) => {
    // Androiddan kelayotgan start_point va end_point-ni bazadagi from_city va to_city-ga o'giramiz
    const { 
        driver_name, start_point, end_point, 
        trip_date, price, available_seats, car_model 
    } = req.body;

    try {
        const { data, error } = await supabase
            .from('trips')
            .insert([{ 
                driver_name, 
                from_city: start_point, // Mapping
                to_city: end_point,     // Mapping
                departure_time: trip_date, 
                price, 
                available_seats, 
                car_model 
            }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ${PORT}-portda ishga tushdi!`);
});
