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

// 1. Safarlarni olish (GET)
app.get('/api/trips', async (req, res) => {
    console.log("GET so'rovi keldi..."); // Debug uchun
    const { from, to } = req.query; 

    try {
        let query = supabase
            .from('trips')
            .select('*')
            .order('created_at', { ascending: false });

        if (from) query = query.ilike('from_city', `%${from}%`);
        if (to) query = query.ilike('to_city', `%${to}%`);

        const { data, error } = await query;
        if (error) throw error;

        // ✅ ANDROID TripDto BILAN 100% MOSLASHTIRISH
        const formattedData = data.map(t => ({
            id: t.id.toString(),
            driverName: t.driver_name,      // Kotlin CamelCase-ga mos
            startPoint: t.from_city,        // Kotlin CamelCase-ga mos
            endPoint: t.to_city,            // Kotlin CamelCase-ga mos
            tripDate: t.departure_time,
            availableSeats: t.available_seats,
            price: parseFloat(t.price),
            carModel: t.car_model || ""
        }));

        res.json(formattedData);
    } catch (err) {
        console.error("GET Xatosi:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. Yangi safar qo'shish (POST)
app.post('/api/trips', async (req, res) => {
    console.log("POST so'rovi keldi:", req.body); // Kelayotgan ma'lumotni logda ko'ramiz

    // Androiddan kelayotgan maydon nomlarini qabul qilamiz
    const { 
        driverName, startPoint, endPoint, 
        tripDate, price, availableSeats, carModel 
    } = req.body;

    try {
        const { data, error } = await supabase
            .from('trips')
            .insert([{ 
                driver_name: driverName, 
                from_city: startPoint, 
                to_city: endPoint, 
                departure_time: tripDate, 
                price: price, 
                available_seats: availableSeats, 
                car_model: carModel 
            }])
            .select();

        if (error) throw error;
        console.log("Safar bazaga saqlandi:", data[0]);
        res.status(201).json(data[0]);
    } catch (err) {
        console.error("POST Xatosi:", err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ${PORT}-portda ishga tushdi!`);
});
