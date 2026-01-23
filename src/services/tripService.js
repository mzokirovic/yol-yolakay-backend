const supabase = require('../config/supabase');

class TripService {
    // 1. Safarlarni filtr bilan olish
    async fetchAllTrips(from, to) {
        let query = supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .order('departure_time', { ascending: true });

        if (from) query = query.ilike('from_city', `%${from}%`);
        if (to) query = query.ilike('to_city', `%${to}%`);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    // 2. CRITICAL: Joy band qilish mantiqi
    async bookSeat(tripId, bookingData) {
        const { seatNumber, passengerId, passengerName, passengerPhone } = bookingData;

        // A. Tekshirish: O'rin bo'shmi?
        const { data: existing } = await supabase
            .from('bookings')
            .select('id')
            .eq('trip_id', tripId)
            .eq('seat_number', seatNumber)
            .maybeSingle();

        if (existing) throw new Error("Bu o'rindiq allaqachon band!");

        // B. Safar ma'lumotini olish
        const { data: trip, error: tripErr } = await supabase
            .from('trips')
            .select('driver_id, available_seats, from_city, to_city')
            .eq('id', tripId)
            .single();

        if (tripErr || !trip) throw new Error("Safar topilmadi");

        // C. Band qilish (Insert)
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

        // D. Joylar sonini kamaytirish
        if (trip.available_seats > 0) {
            await supabase
                .from('trips')
                .update({ available_seats: trip.available_seats - 1 })
                .eq('id', tripId);
        }

        // E. Notification yaratish (Bu boshqa servisga tegishli bo'lishi kerak, hozircha shu yerda)
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

