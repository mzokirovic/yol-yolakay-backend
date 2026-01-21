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
 * Android TripDto kontraktiga moslashtirish (Mapping)
 * Muhim: Android @SerialName parametrlariga mos kelishi shart.
 */
const mapTripData = (t) => {
    const seatsMap = {};
    const totalSeats = 4;

    for (let i = 1; i <= totalSeats; i++) {
        seatsMap[i.toString()] = { // Kalit String bo'lishi kerak: "1", "2"...
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
        driver_name: t.driver_name,      // Android: driver_name
        phone_number: t.phone_number,    // Android: phone_number
        from_city: t.from_city,          // Android: from_city
        to_city: t.to_city,              // Android: to_city
        departure_time: t.departure_time,// Android: departure_time
        available_seats: Number(t.available_seats),
        price: Number(t.price),
        car_model: t.car_model,          // Android: car_model
        seats: seatsMap,
        // Qo'shimcha maydonlar (null-safe)
        startLat: t.start_lat || null,
        startLng: t.start_lng || null,
        endLat: t.end_lat || null,
        endLng: t.end_lng || null
    };
};

/**
 * 1. Barcha safarlarni olish
 */
app.get('/api/trips', async (req, res) => {
    const { from, to } = req.query;
    try {
        let query = supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .order('departure_time', { ascending: true });

        // Agar bazada ma'lumot ko'rinmasa, quyidagi .gte qatorini kommentga olib tekshiring
        // .gte('departure_time', new Date().toISOString()) 

        if (from) query = query.ilike('from_city', `%${from}%`);
        if (to) query = query.ilike('to_city', `%${to}%`);

        const { data, error } = await query;
        if (error) throw error;

        // Ma'lumotlarni xaritaga o'girib yuborish
        res.status(200).json((data || []).map(mapTripData));
    } catch (err) {
        console.error("GET Trips Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 2. Safar yaratish (Androiddan kelayotgan DTO bo'yicha)
 */
app.post('/api/trips', async (req, res) => {
    // Android DTO dan maydonlarni sug'urib olish
    const { 
        driver_name, 
        phone_number, 
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
            .insert([{ 
                driver_name: driver_name, 
                phone_number: phone_number, 
                from_city: from_city, 
                to_city: to_city, 
                departure_time: departure_time, 
                price: price, 
                available_seats: available_seats || 4, 
                car_model: car_model 
            }])
            .select();

        if (error) throw error;
        res.status(201).json(mapTripData(data[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 3. Safar tafsilotlari (ID bo'yicha)
 */
app.get('/api/trips/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.status(200).json(mapTripData(data));
    } catch (err) {
        res.status(404).json({ error: "Safar topilmadi" });
    }
});

/**
 * 4. O'rindiqni band qilish
 */
app.post('/api/trips/:id/book-seat', async (req, res) => {
    const { id } = req.params;
    const { seatNumber, passengerId, passengerName, passengerPhone } = req.body;

    try {
        const { data: existing } = await supabase
            .from('bookings')
            .select('id')
            .match({ trip_id: id, seat_number: seatNumber })
            .maybeSingle();

        if (existing) return res.status(409).json({ error: "Bu o'rindiq band" });

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

        // O'rinlar sonini yangilash
        const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', id).single();
        if (trip && trip.available_seats > 0) {
            await supabase.from('trips').update({ available_seats: trip.available_seats - 1 }).eq('id', id);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 5. Safarni o'chirish
 */
app.delete('/api/trips/:id', async (req, res) => {
    try {
        await supabase.from('bookings').delete().eq('trip_id', req.params.id);
        const { error } = await supabase.from('trips').delete().eq('id', req.params.id);
        if (error) throw error;
        res.status(200).json({ status: "success" });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});


// Mashhur joylarni olish
app.get('/api/popular-points', async (req, res) => {
    const { city } = req.query; // shahar bo'yicha filtrlash uchun
    let query = supabase.from('popular_points').select('*').eq('is_active', true);
    
    if (city) {
        query = query.ilike('city_name', `%${city}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json(error);
    res.json(data);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
