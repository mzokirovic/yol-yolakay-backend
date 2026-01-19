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
            .order('created_at', { ascending: false });

        if (from) query = query.ilike('from_city', `%${from}%`);
        if (to) query = query.ilike('to_city', `%${to}%`);

        const { data, error } = await query;
        if (error) throw error;

        const responseData = (data || []).map(t => {
            const seatsMap = {};
            for (let i = 1; i <= 4; i++) {
                seatsMap[i] = {
                    seatNumber: i,
                    status: "AVAILABLE",
                    passengerId: null,
                    passengerName: null
                };
            }

            t.bookings.forEach(b => {
                seatsMap[b.seat_number] = {
                    seatNumber: b.seat_number,
                    status: "BOOKED",
                    passengerId: b.passenger_id,
                    passengerName: b.passenger_name,
                    passenger_phone: b.passenger_phone
                };
            });

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
        });

        res.status(200).json(responseData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🔥 YANGI: Safar yaratish (POST /api/trips)
 * Senior Approach: Androiddan kelayotgan JSON kalitlarini bazaga moslaymiz
 */
app.post('/api/trips', async (req, res) => {
    const { 
        driverName, 
        phoneNumber, 
        startPoint, 
        endPoint, 
        tripDate, 
        price, 
        availableSeats, 
        carModel 
    } = req.body;

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
        console.error("Post Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 2. O'rindiqni band qilish (POST)
 */
app.post('/api/trips/:id/book-seat', async (req, res) => {
    const { id } = req.params;
    const { seatNumber, passengerId, passengerName, passengerAvatar } = req.body;

    try {
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
            if (bookErr.code === '23505') return res.status(400).json({ message: "Bu o'rin band qilingan!" });
            throw bookErr;
        }

        const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', id).single();
        await supabase.from('trips').update({ available_seats: trip.available_seats - 1 }).eq('id', id);

        res.status(200).json({ status: "success" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * 3. Safarni band qilish (Seats bilan)
 */
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

/**
 * 4. Safarni o'chirish (DELETE)
 */
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
