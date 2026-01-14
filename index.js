const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();app.use(cors());
app.use(express.json()); // Bu qator juda muhim, Androiddan kelgan JSONni o'qish uchun

// Supabase ulanishi
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// 1. Safarlarni olish (GET)
app.get('/api/trips', async (req, res) => {
    try {
        const { data, error } = await supabase.from('trips').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Yangi safar qo'shish (POST) - MANA SHU YERGA QO'SHILDI
app.post('/api/trips', async (req, res) => {
    console.log("LOG: Yangi safar qo'shish so'rovi keldi:", req.body);
    
    const { 
        driver_name, 
        from_city, 
        to_city, 
        departure_time, 
        price, 
        available_seats, 
        car_model 
    } = req.body;

    try {
        const { data, error } = await supabase
            .from('trips')
            .insert([
                { 
                    driver_name, 
                    from_city, 
                    to_city, 
                    departure_time, 
                    price, 
                    available_seats, 
                    car_model 
                }
            ])
            .select(); // Yangi qo'shilgan ma'lumotni qaytarib olish

        if (error) {
            console.error("Supabase xatosi:", error.message);
            return res.status(500).json({ error: error.message });
        }

        console.log("LOG: Safar muvaffaqiyatli saqlandi!");
        res.status(201).json(data[0]);
    } catch (err) {
        console.error("Server xatosi:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Serverni ishga tushirish (Professional va Deployment-ga tayyor variant)
const PORT = process.env.PORT || 3000; // Render o'zining PORT-ini bersa o'shani oladi, bo'lmasa 3000

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ${PORT}-portda muvaffaqiyatli ishga tushdi!`);
    console.log(`Barcha tarmoqlardan ulanish ochiq (0.0.0.0)`);
});
