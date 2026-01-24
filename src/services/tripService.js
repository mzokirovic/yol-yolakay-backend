const supabase = require('../config/supabase');

class TripService {
    async createTrip(tripData) {
        const {
            driver_id, driver_name, from_city, to_city,
            price, available_seats, departure_time,
            car_model, driver_phone,
            start_lat, start_lng, end_lat, end_lng
        } = tripData;

        // Profilni Upsert qilish (FK xatosini oldini oladi)
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

    // 🔥 YANGI: ID orqali safarni qidirish mantiqi
    async fetchTripById(tripId) {
        const { data, error } = await supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .eq('id', tripId)
            .maybeSingle(); // single() o'rniga maybeSingle() - xavfsizroq

        if (error) throw error;
        return data;
    }

    async bookSeat(tripId, bookingData) {
        const { seatNumber, passengerId, passengerName, passengerPhone } = bookingData;

        await supabase.from('profiles').upsert({
            id: passengerId,
            full_name: passengerName,
            phone_number: passengerPhone
        });

        const { data: existing } = await supabase
            .from('bookings')
            .select('id')
            .eq('trip_id', tripId)
            .eq('seat_number', seatNumber)
            .maybeSingle();

        if (existing) throw new Error("Bu o'rindiq allaqachon band!");

        const { data: trip, error: tripErr } = await supabase
            .from('trips')
            .select('*')
            .eq('id', tripId)
            .single();

        if (tripErr || !trip) throw new Error("Safar topilmadi");
        if (trip.available_seats <= 0) throw new Error("Bo'sh joy qolmagan!");

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

        await supabase
            .from('trips')
            .update({ available_seats: trip.available_seats - 1 })
            .eq('id', tripId);

        await supabase.from('notifications').insert([{
            user_id: trip.driver_id,
            title: "Yangi yo'lovchi! 🚗",
            body: `${passengerName} ${trip.from_city} -> ${trip.to_city} yo'nalishida ${seatNumber}-o'rinni band qildi.`,
            type: "BOOKING"
        }]);

        return { success: true };
    }
}

module.exports = new TripService();
