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

    // 2. Barcha safarlarni qidirish
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

    // 3. ID bo'yicha safar (Hydration bilan)
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
            const booking = (trip.bookings || []).find(b => parseInt(b.seat_number) === i);
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

    // 4. Mening haydovchi sifatidagi safarlarim
    async fetchMyDriverTrips(userId) {
        const { data, error } = await supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name)`)
            .eq('driver_id', userId)
            .order('departure_time', { ascending: false });
        if (error) throw error;
        return data;
    }

    // 5. Mening yo'lovchi sifatidagi buyurtmalarim
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

    // 6. O'rindiq band qilish (TUZATILDI - BULLETPROOF)
    a    async bookSeat(tripId, bookingData) {
             const seat_number = bookingData.seat_number || bookingData.seatNumber;
             const passenger_id = bookingData.passenger_id || bookingData.passengerId;
             const passenger_name = bookingData.passenger_name || bookingData.passengerName;

             const finalSeatNumber = parseInt(seat_number);

             // 🚨 SENIOR LOGIC: Haydovchi bloklayaptimi yoki yo'lovchi band qilyaptimi?
             const isDriverBlocking = (passenger_id === 'DRIVER_BLOCK' || bookingData.isDriver);

             // 1. Agar bu haydovchi bo'lsa, "passenger_name"ni "BAND QILINGAN" deb qo'yamiz
             const finalName = isDriverBlocking ? "Yopilgan joy" : passenger_name;

             // 2. Insert qilish
             const { error: bookErr } = await supabase
                 .from('bookings')
                 .insert([{
                     trip_id: tripId,
                     seat_number: finalSeatNumber,
                     passenger_id: isDriverBlocking ? 'DRIVER_BLOCK' : passenger_id,
                     passenger_name: finalName,
                     passenger_phone: isDriverBlocking ? '' : (bookingData.passenger_phone || bookingData.passengerPhone)
                 }]);

             if (bookErr) throw bookErr;

             // 3. MUHIM: Agar YO'LOVCHI band qilsa, "available_seats"ni kamaytiramiz.
             // Agar HAYDOVCHI shunchaki yopib qo'ysa, "available_seats" kamaymaydi (chunki bu sotilgan joy emas).
             if (!isDriverBlocking) {
                 const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', tripId).single();
                 if (trip) {
                     await supabase.from('trips')
                         .update({ available_seats: trip.available_seats - 1 })
                         .eq('id', tripId);
                 }
             }

             return { success: true };
         }
    }

    // 7. Joyni bekor qilish
    async cancelSeat(tripId, cancelData) {
        const seat_number = cancelData.seat_number || cancelData.seatNumber;
        const user_id = cancelData.user_id || cancelData.userId;
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