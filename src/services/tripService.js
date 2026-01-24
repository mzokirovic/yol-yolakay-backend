const supabase = require('../config/supabase');

class TripService {
    // 1. Safarlarni filtr bilan olish
    async fetchAllTrips(from, to, date, passengers) {
        let query = supabase
            .from('trips')
            .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
            .order('departure_time', { ascending: true });

        if (from) query = query.ilike('from_city', `%${from}%`);
        if (to) query = query.ilike('to_city', `%${to}%`);


// 2. Sana bo'yicha (Supabase'da departure_time UTC bo'lsa, date() bilan solishtiramiz)
    if (date) {
        // departure_time '2024-05-20T10:00:00' bo'lsa, faqat sanasini solishtiradi
        query = query.gte('departure_time', `${date}T00:00:00`)
                     .lte('departure_time', `${date}T23:59:59`);
    }

    // 3. Yo'lovchilar soni bo'yicha (Bo'sh joylar yetarli bo'lishi kerak)
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

