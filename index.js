const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

/**
 * UTILS: Data Transformation
 */
const mapTripData = (t) => {
    if (!t) return null;
    
    // O'rindiqlarni dinamik shakllantirish
    const seatsMap = {};
    const totalSeats = t.total_seats || 4; // Baza ustuniga qarab

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
        startLat: t.start_lat || null,
        startLng: t.start_lng || null,
        endLat: t.end_lat || null,
        endLng: t.end_lng || null
    };
};

/**
 * 1. GET ALL TRIPS (Filtrlar bilan)
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
        console.error("GET Trips Error:", err.message);
        res.status(500).json({ error: "Server xatosi: Safarlarni yuklab bo'lmadi" });
    }
});

/**
 * 2. GET TRIP BY ID
 */
app.get('/api/trips/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Safar topilmadi" });

        res.status(200).json(mapTripData(data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 3. CREATE TRIP
 */
app.post('/api/trips', async (req, res) => {
    try {
        const tripData = req.body;
        const { data, error } = await supabase
            .from('trips')
            .insert([{
                driver_id: tripData.driver_id,
                driver_name: tripData.driver_name,
                phone_number: tripData.phone_number,
                from_city: tripData.from_city,
                to_city: tripData.to_city,
                departure_time: tripData.departure_time,
                price: tripData.price,
                available_seats: tripData.available_seats || 4,
                car_model: tripData.car_model,
                start_lat: tripData.startLat,
                start_lng: tripData.startLng,
                end_lat: tripData.endLat,
                end_lng: tripData.endLng
            }])
            .select();

        if (error) throw error;
        res.status(201).json(mapTripData(data[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 4. BOOK SEAT (CRITICAL BUSINESS LOGIC)
 */
app.post('/api/trips/:id/book-seat', async (req, res) => {
    const { id } = req.params;
    const { seatNumber, passengerId, passengerName, passengerPhone } = req.body;

    try {
        // A. Avval tekshirish: Bu o'rin bo'shmidi?
        const { data: existingBooking } = await supabase
            .from('bookings')
            .select('id')
            .eq('trip_id', id)
            .eq('seat_number', seatNumber)
            .maybeSingle();

        if (existingBooking) {
            return res.status(400).json({ error: "Bu o'rindiq allaqachon band qilingan!" });
        }

        // B. Safar haqida ma'lumot olish
        const { data: trip } = await supabase
            .from('trips')
            .select('driver_id, available_seats, from_city, to_city')
            .eq('id', id)
            .single();

        if (!trip) return res.status(404).json({ error: "Safar topilmadi" });

        // C. Band qilish (Insert booking)
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

        // D. Safardagi bo'sh joylar sonini yangilash
        if (trip.available_seats > 0) {
            await supabase
                .from('trips')
                .update({ available_seats: trip.available_seats - 1 })
                .eq('id', id);
        }

        // E. Haydovchiga bildirishnoma yuborish
        await supabase.from('notifications').insert([{
            user_id: trip.driver_id,
            title: "Yangi yo'lovchi! 🚗",
            body: `${passengerName} ${trip.from_city} -> ${trip.to_city} yo'nalishida ${seatNumber}-o'rinni band qildi.`,
            is_read: false,
            type: "BOOKING"
        }]);

        res.status(200).json({ success: true, message: "Joy band qilindi" });

    } catch (err) {
        console.error("Booking Error:", err.message);
        res.status(500).json({ error: "Band qilishda texnik xatolik: " + err.message });
    }
});

/**
 * 5. GET NOTIFICATIONS
 */
app.get('/api/notifications', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id talab qilinadi" });

    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 6. LEAVE REVIEW
 */
app.post('/api/reviews', async (req, res) => {
    const { reviewer_id, target_user_id, rating, comment, trip_id } = req.body;
    try {
        const { error } = await supabase
            .from('reviews')
            .insert([{
                reviewer_id,
                target_user_id,
                rating,
                comment,
                trip_id
            }]);

        if (error) throw error;
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Senior-level Server running on port ${PORT}`);
});
