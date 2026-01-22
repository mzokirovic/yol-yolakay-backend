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

/**
 * Android TripDto kontraktiga mapping qilish
 */
const mapTripData = (t) => {
    if (!t) return null;
    const seatsMap = {};
    const totalSeats = 4;

    for (let i = 1; i <= totalSeats; i++) {
        seatsMap[i.toString()] = {
            seatNumber: i,
            status: "AVAILABLE",
            passengerId: null,
            passengerName: null,
            passengerPhone: null
        };
    }

    if (t.bookings && Array.isArray(t.bookings)) {
        t.bookings.forEach(b => {
            if (seatsMap[b.seat_number.toString()]) {
                seatsMap[b.seat_number.toString()] = {
                    seatNumber: b.seat_number,
                    status: b.passenger_id === 'DRIVER_BLOCK' ? 'BLOCKED' : 'BOOKED',
                    passengerId: b.passenger_id,
                    passengerName: b.passenger_name,
                    passengerPhone: b.passenger_phone
                };
            }
        });
    }

    return {
        id: t.id.toString(),
        driver_id: t.driver_id,
        driver_name: t.driver_name,
        phone_number: t.phone_number,
        from_city: t.from_city,
        to_city: t.to_city,
        departure_time: t.departure_time,
        available_seats: Number(t.available_seats),
        price: Number(t.price),
        car_model: t.car_model,
        seats: seatsMap,
        startLat: t.start_lat || t.startLat || null,
        startLng: t.start_lng || t.startLng || null,
        endLat: t.end_lat || t.endLat || null,
        endLng: t.end_lng || t.endLng || null
    };
};

/**
 * 1. BARCHA SAFARLARNI OLISH
 */
app.get('/api/trips', async (req, res) => {
    const { from, to } = req.query;
    try {
        let query = supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .order('departure_time', { ascending: true });

        if (from) query = query.ilike('from_city', `%${from}%`);
        if (to) query = query.ilike('to_city', `%${to}%`);

        const { data, error } = await query;
        if (error) throw error;

        res.status(200).json((data || []).map(mapTripData));
    } catch (err) {
        console.error("GET /api/trips error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 2. BITTA SAFARNI ID BO'YICHA OLISH (LOGCATDAGI 404 NI TUZATUVCHI QISM)
 */
app.get('/api/trips/:id', async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`🔍 Safar so'ralmoqda: ${id}`);
        const { data, error } = await supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        
        if (!data) {
            console.warn(`⚠️ Safar topilmadi: ${id}`);
            return res.status(404).json({ error: "Safar topilmadi" });
        }

        res.status(200).json(mapTripData(data));
    } catch (err) {
        console.error(`❌ Detail error (${id}):`, err.message);
        res.status(500).json({ error: "Server ichki xatosi" });
    }
});

/**
 * 3. YANGI SAFAR YARATISH
 */
app.post('/api/trips', async (req, res) => {
    const { driver_id, driver_name, phone_number, from_city, to_city, departure_time, price, available_seats, car_model } = req.body;

    if (!driver_id) return res.status(400).json({ error: "driver_id talab qilinadi" });

    try {
        const { data, error } = await supabase
            .from('trips')
            .insert([{ driver_id, driver_name, phone_number, from_city, to_city, departure_time, price, available_seats: available_seats || 4, car_model }])
            .select();

        if (error) throw error;
        res.status(201).json(mapTripData(data[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 4. O'RINDIQ BAND QILISH VA BILDIRISNOMA
 */
app.post('/api/trips/:id/book-seat', async (req, res) => {
    const { id } = req.params;
    const { seatNumber, passengerId, passengerName, passengerPhone } = req.body;

    try {
        const { data: trip, error: tripError } = await supabase
            .from('trips')
            .select('driver_id, available_seats')
            .eq('id', id)
            .single();

        if (tripError || !trip) return res.status(404).json({ error: "Safar topilmadi" });

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

        // Bildirishnoma yuborish
        await supabase.from('notifications').insert([{
            user_id: trip.driver_id, 
            title: "Yangi bandlov! 🚗",
            body: `${passengerName} ${seatNumber}-o'rindiqni band qildi.`,
            is_read: false
        }]);

        if (trip.available_seats > 0) {
            await supabase.from('trips').update({ available_seats: trip.available_seats - 1 }).eq('id', id);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 5. BILDIRISNOMALARNI OLISH
 */
app.get('/api/notifications', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id talab qilinadi" });

    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
