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
 * Yordamchi funksiya: Ma'lumotlarni Android formatiga o'tkazish
 */
const mapTripData = (t) => {
    const seatsMap = {};
    const totalSeats = 4; // Standart o'rinlar soni

    for (let i = 1; i <= totalSeats; i++) {
        seatsMap[i] = {
            seatNumber: i,
            status: "AVAILABLE",
            passengerId: null,
            passengerName: null
        };
    }

    if (t.bookings && Array.isArray(t.bookings)) {
        t.bookings.forEach(b => {
            if (seatsMap[b.seat_number]) {
                seatsMap[b.seat_number] = {
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
 * 1. Barcha safarlarni olish (Filter bilan)
 */
app.get('/api/trips', async (req, res) => {
    const { from, to } = req.query;
    try {
        let query = supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            // Faqat kelajakdagi safarlarni ko'rsatish (ixtiyoriy)
            .gte('departure_time', new Date().toISOString()) 
            .order('departure_time', { ascending: true });

        if (from) query = query.ilike('from_city', `%${from}%`);
        if (to) query = query.ilike('to_city', `%${to}%`);

        const { data, error } = await query;
        if (error) throw error;

        res.status(200).json((data || []).map(mapTripData));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 2. Safar yaratish
 */
app.post('/api/trips', async (req, res) => {
    const { driverName, phoneNumber, startPoint, endPoint, tripDate, price, availableSeats, carModel } = req.body;
    
    // Oddiy validatsiya
    if (!driverName || !phoneNumber || !startPoint || !endPoint) {
        return res.status(400).json({ error: "Barcha maydonlarni to'ldiring" });
    }

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
                available_seats: availableSeats || 4, 
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
 * 3. O'rindiqni band qilish (Xavfsiz usul)
 */
app.post('/api/trips/:id/book-seat', async (req, res) => {
    const { id } = req.params;
    const { seatNumber, passengerId, passengerName, passengerPhone } = req.body;

    try {
        // 1. O'rindiq bandligini tekshirish
        const { data: existing } = await supabase
            .from('bookings')
            .select('id')
            .match({ trip_id: id, seat_number: seatNumber })
            .maybeSingle();

        if (existing) return res.status(409).json({ error: "Bu o'rindiq allaqachon band" });

        // 2. Band qilish
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

        // 3. O'rinlar sonini decrement qilish
        // RPC funksiyasini Supabase Dashboardda yaratgan bo'lishingiz kerak
        const { error: updateError } = await supabase.rpc('decrement_available_seats', { t_id: id });
        
        // Agar RPC bo'lmasa, oddiy update (Lekin RPC tavsiya etiladi)
        if (updateError) {
             const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', id).single();
             if (trip && trip.available_seats > 0) {
                 await supabase.from('trips').update({ available_seats: trip.available_seats - 1 }).eq('id', id);
             }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 4. Safarni o'chirish
 */
app.delete('/api/trips/:id', async (req, res) => {
    try {
        // Avval bog'langan bookinglarni o'chirish (Foreign Key constraint bo'lsa)
        await supabase.from('bookings').delete().eq('trip_id', req.params.id);
        const { error } = await supabase.from('trips').delete().eq('id', req.params.id);
        
        if (error) throw error;
        res.status(200).json({ status: "success" });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
