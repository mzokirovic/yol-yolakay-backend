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

/**
 * 1. Safarlarni olish (GET)
 * Senior Feature: Pagination (kelajakda) va aqlli filtr
 */
app.get('/api/trips', async (req, res) => {
    const { from, to } = req.query; 

    try {
        let query = supabase
            .from('trips')
            .select('*')
            .order('created_at', { ascending: false });

        // Filtrlar faqat qiymat mavjud bo'lganda qo'shiladi
        if (from && from.trim() !== "") {
            query = query.ilike('from_city', `%${from.trim()}%`);
        }
        if (to && to.trim() !== "") {
            query = query.ilike('to_city', `%${to.trim()}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        // ✅ DATA MAPPING: Front-end (Android) kutayotgan modelga o'girish
        const responseData = (data || []).map(t => ({
            id: t.id.toString(),
            driverName: t.driver_name || "Noma'lum",      
            phoneNumber: t.phone_number || "Raqam yo'q",
            startPoint: t.from_city || "Noma'lum",        
            endPoint: t.to_city || "Noma'lum",            
            tripDate: t.departure_time || "",
            availableSeats: Number(t.available_seats) || 0,
            price: Number(t.price) || 0,
            carModel: t.car_model || "Noma'lum"
        }));

        res.status(200).json(responseData);
    } catch (err) {
        console.error("Critical GET Error:", err.message);
        res.status(500).json({ status: "error", message: "Serverda ichki xatolik yuz berdi" });
    }
});

/**
 * 2. Yangi safar qo'shish (POST)
 * Senior Feature: Data Validation va Default qiymatlar
 */
/**
 * 2. Yangi safar qo'shish (POST)
 */
app.post('/api/trips', async (req, res) => {
    // Android'dan kelayotgan maydonlar (driverId qo'shildi)
    const {        driverId, driverName, phoneNumber, startPoint, endPoint, 
        tripDate, price, availableSeats, carModel 
    } = req.body;

    // 🔴 Validation
    if (!startPoint || !endPoint || !driverName) {
        return res.status(400).json({ 
            status: "error", 
            message: "Majburiy maydonlar kiritilmagan!" 
        });
    }

    try {
        const payload = { 
            // driver_id: driverId || "anonymous", // Supabase'da bu ustun bo'lsa yoqing
            driver_name: driverName, 
            phone_number: phoneNumber || "+998000000000",
            from_city: startPoint, 
            to_city: endPoint, 
            departure_time: tripDate, // Android yuborgan stringni o'zi
            price: Number(price) || 0, 
            available_seats: Number(availableSeats) || 1, 
            car_model: carModel || "Noma'lum" 
        };

        const { data, error } = await supabase
            .from('trips')
            .insert([payload])
            .select();

        if (error) {
            console.error("Supabase Insert Error:", error.message);
            throw error;
        }
        
        res.status(201).json({ status: "success", data: data[0] });

    } catch (err) {
        console.error("Critical POST Error:", err.message);
        res.status(500).json({ status: "error", message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Senior Backend running on port ${PORT}`);
});
