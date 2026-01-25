const supabase = require('../config/supabase');

class TripService {
    // 1. Yangi safar yaratish
    async createTrip(tripData) {
        const {
            driver_id, driver_name, from_city, to_city,
            price, available_seats, departure_time,
            car_model, driver_phone,
            start_lat, start_lng, end_lat, end_lng
        } = tripData;

        // Profilni yangilash yoki yaratish
        await supabase.from('profiles').upsert({
            id: driver_id,
            full_name: driver_name,
            phone_number: driver_phone,
            car_model: car_model
        });

        const { data, error } = await supabase
            .from('trips')
            .insert([{
                driver_id,
                driver_name,
                from_city,
                to_city,
                price,
                available_seats,
                departure_time,
                car_model,
                phone_number: driver_phone,
                start_lat,
                start_lng,
                end_lat,
                end_lng
            }])
            .select().single();

        if (error) throw error;
        return data;
    }

    // 2. Barcha safarlarni qidirish va filterlash
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
            if (!isNaN(pCount)) {
                query = query.gte('available_seats', pCount);
            }
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    // 3. ID bo'yicha safar va uning dinamik o'rindiqlarini olish
    async fetchTripById(tripId) {
        const { data: trip, error } = await supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .eq('id', tripId)
            .maybeSingle();

        if (error) throw error;
        if (!trip) return null;

        const totalSeats = 4;
        const fullSeatsArray = [];

        for (let i = 1; i <= totalSeats; i++) {
            const booking = (trip.bookings || []).find(b => b.seat_number === i);
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

        return {
            ...trip,
            generated_seats: fullSeatsArray
        };
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
            const tripIds = bookings.map(b => b.trip_id);

            const { data, error } = await supabase
                .from('trips')
                .select(`*, bookings (seat_number, passenger_id, passenger_name)`)
                .in('id', tripIds)
                .order('departure_time', { ascending: false });

            if (error) throw error;
            return data;
        }


    // 4. O'rindiq band qilish (TUZATILDI: Android Request Contract bilan moslandi)
    async bookSeat(tripId, bookingData) {
        // Android'dan kelayotgan snake_case ma'lumotlarni qabul qilamiz
        const {
            seat_number: seatNumber,
            passenger_id: passengerId,
            passenger_name: passengerName,
            passenger_phone: passengerPhone
        } = bookingData;

        // 1. Profilni upsert qilish
        if (passengerId !== 'DRIVER_BLOCK') {
            await supabase.from('profiles').upsert({
                id: passengerId,
                full_name: passengerName,
                phone_number: passengerPhone
            });
        }

        // 2. Joy band yoki yo'qligini tekshirish
        const { data: existing } = await supabase
            .from('bookings')
            .select('id')
            .eq('trip_id', tripId)
            .eq('seat_number', seatNumber)
            .maybeSingle();

        if (existing) throw new Error("Bu o'rindiq allaqachon band!");

        // 3. Safar va bo'sh joylarni tekshirish
        const { data: trip, error: tripErr } = await supabase
            .from('trips')
            .select('*')
            .eq('id', tripId)
            .single();

        if (tripErr || !trip) throw new Error("Safar topilmadi");

        // Agar haydovchi bloklamayotgan bo'lsa, joy borligini tekshiramiz
        if (passengerId !== 'DRIVER_BLOCK' && trip.available_seats <= 0) {
            throw new Error("Bo'sh joy qolmagan!");
        }

        // 4. Band qilish (DATABASE insert)
        const { error: bookErr } = await supabase
            .from('bookings')
            .insert([{
                trip_id: tripId,
                seat_number: seatNumber,
                passenger_id: passengerId,
                passenger_name: passengerName,
                passenger_phone: passengerPhone
            }]);

        if (bookErr) throw bookErr;

        // 5. Agar bu oddiy yo'lovchi bo'lsa, bo'sh joylar sonini kamaytirish
        if (passengerId !== 'DRIVER_BLOCK') {
            await supabase
                .from('trips')
                .update({ available_seats: trip.available_seats - 1 })
                .eq('id', tripId);
        }

        // 6. Haydovchiga bildirishnoma (Faqat yo'lovchi band qilganda)
        if (passengerId !== 'DRIVER_BLOCK') {
            await supabase.from('notifications').insert([{
                user_id: trip.driver_id,
                title: "Yangi yo'lovchi! 🚗",
                body: `${passengerName} ${seatNumber}-o'rinni band qildi.`,
                type: "BOOKING"
            }]);
        }

        return { success: true };
    }

    // 5. O'rindiqni bekor qilish (YANGI: Android CancelBookingUseCase uchun)
    async cancelSeat(tripId, cancelData) {
        const { seat_number: seatNumber, user_id: userId } = cancelData;

        // 1. Bandni topish
        const { data: booking, error: findErr } = await supabase
            .from('bookings')
            .select('*')
            .eq('trip_id', tripId)
            .eq('seat_number', seatNumber)
            .maybeSingle();

        if (findErr || !booking) throw new Error("Band qilingan joy topilmadi");

        // 2. Xavfsizlik: Faqat o'z joyini yoki haydovchi blokni ocha oladi
        // (Kelajakda bu yerda JWT token orqali tekshirish ham bo'ladi)

        // 3. O'chirish
        const { error: delErr } = await supabase
            .from('bookings')
            .delete()
            .eq('trip_id', tripId)
            .eq('seat_number', seatNumber);

        if (delErr) throw delErr;

        // 4. Agar bu blok bo'lmagan bo'lsa, joyni qayta qo'shish
        if (booking.passenger_id !== 'DRIVER_BLOCK') {
            const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', tripId).single();
            if (trip) {
                await supabase
                    .from('trips')
                    .update({ available_seats: trip.available_seats + 1 })
                    .eq('id', tripId);
            }
        }

        return { success: true };
    }
}

module.exports = new TripService();