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
 * Yordamchi funksiya: Safar ma'lumotlarini Android kutayotgan formatga o'girish
 * (DRY - Don't Repeat Yourself printsipi asosida)
 */
const mapTripData = (t) => {
    const seatsMap = {};
    // Barcha 4 ta o'rinni standart holati (AVAILABLE)
    for (let i = 1; i <= 4; i++) {
        seatsMap[i] = {
            seatNumber: i,
            status: "AVAILABLE",
            passengerId: null,
            passengerName: null
        };
    }

    // Band qilingan o'rinlarni ustidan yozish
    if (t.bookings && Array.isArray(t.bookings)) {
        t.bookings.forEach(b => {
            seatsMap[b.seat_number] = {
                seatNumber: b.seat_number,
                status: b.passenger_id === 'DRIVER_BLOCK' ? 'BLOCKED' : 'BOOKED',
                passengerId: b.passenger_id,
                passengerName: b.passenger_name,
                passengerPhone: b.passenger_phone
            };
        });
    }

    return {
        id: t.id.toString(),
        driverName: t.driver_name,
        phoneNumber: t.phone_number,
        startPoint: t.from_city,
        endPoint: t.to_city,
        tripDate: t.departure_time,
        availableSeats: Number(t.available_seats),
        price: Number(t.price),
        carModel: t.car_model,
        seats: seatsMap
    };
};

/**
 * 1. Barcha safarlarni olish (GET)
 * Qidiruv filtrlari (from, to) bilan ishlaydi
 */
app.get('/api/trips', async (req, res) => {
    const { from, to } = req.query; 
    try {
        let query = supabase
            .from('trips')
            .select(`
                *,
                bookings (
                    seat_number,
                    passenger_id,
                    passenger_name,
                    passenger_phone
                )
            `)
            .order('departure_time', { ascending: true });

        if (from) query = query.ilike('from_city', `%${from}%`);
        if (to) query = query.ilike('to_city', `%${to}%`);

        const { data, error } = await query;
        if (error) throw error;

        const responseData = (data || []).map(t => mapTripData(t));
        res.status(200).json(responseData);
    } catch (err) {
        console.error("GET /api/trips error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 2. Bitta safarni ID bo'yicha olish (GET)
 * Details ekrani uchun muhim!
 */
app.get('/api/trips/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: t, error } = await supabase
            .from('trips')
            .select(`
                *,
                bookings (
                    seat_number,
                    passenger_id,
                    passenger_name,
                    passenger_phone
                )
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!t) return res.status(404).json({ error: "Safar topilmadi" });

        res.status(200).json(mapTripData(t));
    } catch (err) {
        console.error("GET /api/trips/:id error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 3. Safar yaratish (POST)
 */
app.post('/api/trips', async (req, res) => {
    const { driverName, phoneNumber, startPoint, endPoint, tripDate, price, availableSeats, carModel } = req.body;
    try {
        const { data, error } = await supabase
            .from('trips')
            .insert([{ 
                driver_name: driverName, 
                phone_number: phoneNumber, 
                from_city: startPoint, 
                to_city: endPoint, 
                departure_time: tripDate, 
                price: price, 
                available_seats: availableSeats, 
                car_model: carModel 
            }])
            .select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 4. O'rindiqni band qilish (POST)
 */
app.post('/api/trips/:id/book-seat', async (req, res) => {
    const { id } = req.params;
    const { seatNumber, passengerId, passengerName, passengerPhone } = req.body;

    try {
        // O'rindiq bo'shligini tekshirish
        const { data: existing } = await supabase
            .from('bookings')
            .select('id')
            .match({ trip_id: id, seat_number: seatNumber })
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ error: "Bu o'rindiq allaqachon band" });
        }

        // Band qilish
        const { error: bookingError } = await supabase
            .from('bookings')
            .insert([{
                trip_id: id,
                seat_number: seatNumber,
                passenger_id: passengerId,
                passenger_name: passengerName,
                passenger_phone: passengerPhone
            }]);

        if (bookingError) throw bookingError;

        // O'rinlar sonini kamaytirish
        const { error: updateError } = await supabase.rpc('decrement_available_seats', { t_id: id });
        
        if (updateError) {
             const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', id).single();
             if (trip && trip.available_seats > 0) {
                 await supabase.from('trips').update({ available_seats: trip.available_seats - 1 }).eq('id', id);
             }
        }

        res.json({ success: true, message: "Muvaffaqiyatli band qilindi" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 5. Safarni o'chirish (DELETE)
 */
app.delete('/api/trips/:id', async (req, res) => {
    try {
        await supabase.from('bookings').delete().eq('trip_id', req.params.id);
        const { error } = await supabase.from('trips').delete().eq('id', req.params.id);
        if (error) throw error;
        res.status(200).json({ status: "success" });
    } catch (err) { 
        res.status(500).json({ message: err.message }); 
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Senior Backend running on port ${PORT}`);
});
