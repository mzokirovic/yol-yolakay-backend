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
 * Senior Feature: Data Validation va Default qiymatlar
 */
/**
 * 2. Yangi safar qo'shish (POST)
 */
app.post('/api/trips/:id/book-seat', async (req, res) => {
    const { id } = req.params; // Bu UUID string
    const { seatNumber, passengerId, passengerName, passengerAvatar } = req.body;

    try {
        // 1. Band qilish
        const { error: bookErr } = await supabase
            .from('bookings')
            .insert([{ 
                trip_id: id, 
                seat_number: seatNumber, 
                passenger_id: passengerId,
                passenger_name: passengerName,
                passenger_avatar: passengerAvatar
            }]);

        if (bookErr) {
            if (bookErr.code === '23505') {
                return res.status(400).json({ message: "Bu o'rin band qilingan!" });
            }
            throw bookErr;
        }

        // 2. Trips jadvalidagi available_seats sonini kamaytirish
        // Senior tip: Bu yerda bitta o'rin band bo'lgani uchun 1 ga kamaytiramiz
        const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', id).single();
        await supabase.from('trips').update({ available_seats: trip.available_seats - 1 }).eq('id', id);

        res.status(200).json({ status: "success" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// 3. Safarni band qilish (Seats bilan)
app.post('/api/trips/:id/book', async (req, res) => {
    const { id } = req.params;
    const { seats } = req.body;
    try {
        const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', id).single();
        if (trip.available_seats < seats) return res.status(400).json({ message: "Joy yetarli emas" });
        
        await supabase.from('trips').update({ available_seats: trip.available_seats - seats }).eq('id', id);
        res.status(200).json({ status: "success" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 4. Safarni o'chirish
app.delete('/api/trips/:id', async (req, res) => {
    try {
        await supabase.from('trips').delete().eq('id', req.params.id);
        res.status(200).json({ status: "success" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Senior Backend running on port ${PORT}`);
});
