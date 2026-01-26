const supabase = require('../config/supabase');

class TripService {
    /**
     * 1. Yangi safar yaratish (Enhanced for stability)
     * Android DTO dan kelayotgan snake_case maydonlarni qabul qiladi.
     */
    async createTrip(tripData) {
        const {
            driver_id, driver_name, phone_number,
            from_city, to_city, price, available_seats,
            departure_time, car_model,
            start_lat, start_lng, end_lat, end_lng
        } = tripData;

        try {
            // A. Haydovchi profilini yangilash (Background task)
            if (driver_id) {
                await supabase.from('profiles').upsert({
                    id: driver_id,
                    full_name: driver_name || "Noma'lum",
                    phone_number: phone_number || "",
                    car_model: car_model || ""
                }).catch(e => console.error("Profile Upsert Minor Error:", e.message));
            }

            // B. Database Payload tayyorlash (Mapping logic)
            // Ikkala formatni ham to'ldiramiz (camelCase va snake_case)
            const payload = {
                driver_id: driver_id,
                driver_name: driver_name,
                phone_number: phone_number,
                car_model: car_model,
                from_city: from_city,
                to_city: to_city,
                departure_time: departure_time,
                price: parseFloat(price) || 0,
                available_seats: parseInt(available_seats) || 1,

                // Snake Case columns
                start_lat: parseFloat(start_lat) || null,
                start_lng: parseFloat(start_lng) || null,
                end_lat: parseFloat(end_lat) || null,
                end_lng: parseFloat(end_lng) || null,

                // Camel Case columns (Bazadagi startLat kabi ustunlar uchun)
                startLat: parseFloat(start_lat) || null,
                startLng: parseFloat(start_lng) || null,
                endLat: parseFloat(end_lat) || null,
                endLng: parseFloat(end_lng) || null
            };

            // C. Safarni yaratish
            const { data, error } = await supabase
                .from('trips')
                .insert([payload])
                .select()
                .single();

            if (error) {
                console.error("❌ Supabase INSERT FAILED:", error.message, "Payload:", payload);
                throw error;
            }

            console.log("✅ Trip Created Successfully:", data.id);
            return data;

        } catch (err) {
            console.error("❌ TripService.createTrip CRITICAL ERROR:", err.message);
            throw err;
        }
    }

    /**
     * 2. Safarlarni qidirish
     */
    async fetchAllTrips(from, to, date, passengers) {
        let query = supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .order('departure_time', { ascending: true });

        if (from && from.trim() !== "") query = query.ilike('from_city', `%${from}%`);
        if (to && to.trim() !== "") query = query.ilike('to_city', `%${to}%`);

        if (date) {
            query = query.gte('departure_time', `${date}T00:00:00`)
                         .lte('departure_time', `${date}T23:59:59`);
        }

        if (passengers) {
            const pCount = parseInt(passengers);
            if (!isNaN(pCount)) query = query.gte('available_seats', pCount);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    /**
     * 3. ID bo'yicha safar (Dinamik o'rindiqlar generatsiyasi)
     */
    async fetchTripById(tripId) {
        const { data: trip, error } = await supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .eq('id', tripId)
            .maybeSingle();

        if (error) throw error;
        if (!trip) return null;

        const bookedSeats = trip.bookings || [];
        const totalSeats = (trip.available_seats || 0) + bookedSeats.length;

        const fullSeatsArray = [];
        for (let i = 1; i <= totalSeats; i++) {
            const booking = bookedSeats.find(b => parseInt(b.seat_number) === i);
            if (booking) {
                fullSeatsArray.push({
                    seat_number: i,
                    passenger_id: booking.passenger_id,
                    passenger_name: booking.passenger_name,
                    passenger_phone: booking.passenger_phone,
                    status: booking.passenger_id === 'DRIVER_BLOCK' ? 'BLOCKED' : 'BOOKED'
                });
            } else {
                fullSeatsArray.push({
                    seat_number: i,
                    passenger_id: null,
                    passenger_name: null,
                    status: 'AVAILABLE'
                });
            }
        }
        return { ...trip, generated_seats: fullSeatsArray };
    }

    /**
     * 4. O'rindiqni band qilish
     */
    async bookSeat(tripId, bookingData) {
        const seat_number = bookingData.seat_number || bookingData.seatNumber;
        const passenger_id = bookingData.passenger_id || bookingData.passengerId;
        const passenger_name = bookingData.passenger_name || bookingData.passengerName;
        const passenger_phone = bookingData.passenger_phone || bookingData.passengerPhone;

        const finalSeatNumber = parseInt(seat_number);
        const isDriverBlocking = (passenger_id === 'DRIVER_BLOCK');

        const { error: bookErr } = await supabase
            .from('bookings')
            .insert([{
                trip_id: tripId,
                seat_number: finalSeatNumber,
                passenger_id: isDriverBlocking ? 'DRIVER_BLOCK' : passenger_id,
                passenger_name: isDriverBlocking ? "Yopilgan joy" : passenger_name,
                passenger_phone: isDriverBlocking ? '' : passenger_phone
            }]);

        if (bookErr) throw bookErr;

        if (!isDriverBlocking) {
            const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', tripId).single();
            if (trip && trip.available_seats > 0) {
                await supabase.from('trips')
                    .update({ available_seats: trip.available_seats - 1 })
                    .eq('id', tripId);
            }
        }

        return { success: true };
    }

    /**
     * 5. Joyni bekor qilish
     */
    async cancelSeat(tripId, cancelData) {
        const seat_number = cancelData.seat_number || cancelData.seatNumber;
        const finalSeatNumber = parseInt(seat_number);

        const { data: booking, error: findErr } = await supabase
            .from('bookings')
            .select('*')
            .eq('trip_id', tripId)
            .eq('seat_number', finalSeatNumber)
            .maybeSingle();

        if (findErr || !booking) throw new Error("Band qilingan joy topilmadi");

        const { error: delErr } = await supabase
            .from('bookings')
            .delete()
            .eq('trip_id', tripId)
            .eq('seat_number', finalSeatNumber);

        if (delErr) throw delErr;

        if (booking.passenger_id !== 'DRIVER_BLOCK') {
            const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', tripId).single();
            if (trip) {
                await supabase.from('trips')
                    .update({ available_seats: trip.available_seats + 1 })
                    .eq('id', tripId);
            }
        }
        return { success: true };
    }

    async fetchMyDriverTrips(userId) {
        const { data, error } = await supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name)`)
            .eq('driver_id', userId)
            .order('departure_time', { ascending: false });
        if (error) throw error;
        return data;
    }

    async fetchMyBookings(userId) {
        const { data: bookings, error: bError } = await supabase
            .from('bookings')
            .select('trip_id')
            .eq('passenger_id', userId);

        if (bError) throw bError;
        const tripIds = [...new Set(bookings.map(b => b.trip_id))];
        if (tripIds.length === 0) return [];

        const { data, error } = await supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name)`)
            .in('id', tripIds)
            .order('departure_time', { ascending: false });

        if (error) throw error;
        return data;
    }
}

module.exports = new TripService();
