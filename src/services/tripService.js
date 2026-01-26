const supabase = require('../config/supabase');

class TripService {
    /**
     * 1. Yangi safar yaratish
     * Android ilovadan kelayotgan camelCase maydonlarni snake_case ga o'girib saqlaydi.
     */
    async createTrip(tripData) {
        const {
            driverId, driverName, driverPhone,
            fromCity, toCity, price, availableSeats,
            departureTime, carModel,
            startLat, startLng, endLat, endLng
        } = tripData;

        // Haydovchi profilini yangilash yoki yaratish
        await supabase.from('profiles').upsert({
            id: driverId,
            full_name: driverName,
            phone_number: driverPhone,
            car_model: carModel
        });

        // Safarni yaratish (Database ustun nomlariga moslangan)
        const { data, error } = await supabase
            .from('trips')
            .insert([{
                driver_id: driverId,
                driver_name: driverName,
                phone_number: driverPhone,
                from_city: fromCity,
                to_city: toCity,
                price: price,
                available_seats: availableSeats,
                departure_time: departureTime, // Androiddan kelgan ISO String
                car_model: carModel,
                start_lat: startLat,
                start_lng: startLng,
                end_lat: endLat,
                end_lng: endLng
            }])
            .select().single();

        if (error) {
            console.error("Supabase Create Error:", error);
            throw error;
        }
        return data;
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
            // Androiddan kelgan YYYY-MM-DD formatiga vaqt oralig'ini qo'shish
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
     * 3. ID bo'yicha safar (Dinamik o'rindiqlar generatsiyasi bilan)
     * Senior Fix: totalSeats endi qat'iy 4 emas, e'longa qarab o'zgaradi.
     */
    async fetchTripById(tripId) {
        const { data: trip, error } = await supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .eq('id', tripId)
            .maybeSingle();

        if (error) throw error;
        if (!trip) return null;

        // Jami joylar = Hozirgi bo'sh joylar + Band qilingan joylar soni
        const bookedSeats = trip.bookings || [];
        const totalSeats = trip.available_seats + bookedSeats.length;

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
     * 4. O'rindiqni band qilish (Bulletproof)
     */
    async bookSeat(tripId, bookingData) {
        const seat_number = bookingData.seatNumber || bookingData.seat_number;
        const passenger_id = bookingData.passengerId || bookingData.passenger_id;
        const passenger_name = bookingData.passengerName || bookingData.passenger_name;
        const passenger_phone = bookingData.passengerPhone || bookingData.passenger_phone;

        const finalSeatNumber = parseInt(seat_number);
        const isDriverBlocking = (passenger_id === 'DRIVER_BLOCK' || bookingData.isDriver);

        // 1. Band qilish
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

        // 2. Agar yo'lovchi bo'lsa, mavjud joylarni kamaytirish
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
        const seat_number = cancelData.seatNumber || cancelData.seat_number;
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

        // Agar yo'lovchi joyi bekor bo'lsa, joyni qaytaramiz
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