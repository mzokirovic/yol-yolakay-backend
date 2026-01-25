const supabase = require('../config/supabase');

class TripService {// 1. Yangi safar yaratish
    async createTrip(tripData) {
        const {
            driver_id, driver_name, from_city, to_city,
            price, available_seats, departure_time,
            car_model, driver_phone,
            start_lat, start_lng, end_lat, end_lng
        } = tripData;

        // Profilni yangilash yoki yaratish (Foreign Key xatosini oldini olish uchun)
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

        /**
         * Senior Logic: O'rindiqlar sxemasini to'ldirish (Hydration).
         * Android UI 4 ta o'rindiq kutyapti. Bo'sh va band joylarni birlashtiramiz.
         */
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

    // 4. O'rindiq band qilish
    async bookSeat(tripId, bookingData) {
        const { seatNumber, passengerId, passengerName, passengerPhone } = bookingData;

        // Yo'lovchi profilini upsert qilish
        await supabase.from('profiles').upsert({
            id: passengerId,
            full_name: passengerName,
            phone_number: passengerPhone
        });

        // Joy band yoki yo'qligini tekshirish
        const { data: existing } = await supabase
            .from('bookings')
            .select('id')
            .eq('trip_id', tripId)
            .eq('seat_number', seatNumber)
            .maybeSingle();

        if (existing) throw new Error("Bu o'rindiq allaqachon band!");

        // Safar mavjudligini tekshirish
        const { data: trip, error: tripErr } = await supabase
            .from('trips')
            .select('*')
            .eq('id', tripId)
            .single();

        if (tripErr || !trip) throw new Error("Safar topilmadi");
        if (trip.available_seats <= 0) throw new Error("Bo'sh joy qolmagan!");

        // Band qilish
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

        // Bo'sh joylar sonini kamaytirish
        await supabase
            .from('trips')
            .update({ available_seats: trip.available_seats - 1 })
            .eq('id', tripId);

        // Haydovchiga bildirishnoma (Ixtiyoriy)
        await supabase.from('notifications').insert([{
            user_id: trip.driver_id,
            title: "Yangi yo'lovchi! 🚗",
            body: `${passengerName} ${trip.from_city} -> ${trip.to_city} yo'nalishida ${seatNumber}-o'rinni band qildi.`,
            type: "BOOKING"
        }]);

        return { success: true };
    }
}

// Klassdan bitta instansiya eksport qilinadi (Singleton pattern)
module.exports = new TripService();
