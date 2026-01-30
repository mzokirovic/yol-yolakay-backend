const supabase = require('../config/supabase');

const DRIVER_BLOCK = 'DRIVER_BLOCK';

function toInt(value, fieldName) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    const err = new Error(`${fieldName} noto‘g‘ri`);
    err.status = 400;
    throw err;
  }
  return n;
}

function toFloat(value, fieldName) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    const err = new Error(`${fieldName} noto‘g‘ri`);
    err.status = 400;
    throw err;
  }
  return n;
}

function ensure(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === '') {
    const err = new Error(`${fieldName} majburiy`);
    err.status = 400;
    throw err;
  }
  return value;
}

function toServiceError(supabaseError, fallbackStatus = 400) {
  const msg = supabaseError?.message || 'Unknown error';
  const err = new Error(msg);
  err.status = fallbackStatus;
  return err;
}

class TripService {
  /**
   * 1) Create Trip (driver)
   * Hech qanday maydon (Lat/Lng/Profile) o'chirilmagan,
   * faqat xatoliklar bilan ishlash kuchaytirildi.
   */
  async createTrip(tripData) {
    const driver_id = ensure(tripData.driver_id, 'driver_id');
    const from_city = ensure(tripData.from_city, 'from_city');
    const to_city = ensure(tripData.to_city, 'to_city');
    const departure_time = ensure(tripData.departure_time, 'departure_time');

    const driver_name = tripData.driver_name || "Noma'lum";
    const phone_number = tripData.phone_number || "";
    const car_model = tripData.car_model || "";

    const price = tripData.price !== undefined ? toFloat(tripData.price, 'price') : 0;
    const available_seats = tripData.available_seats !== undefined ? toInt(tripData.available_seats, 'available_seats') : 1;

    // Koordinatalar (Lat/Lng) - bularni saqlab qolamiz
    const start_lat = tripData.start_lat !== undefined ? Number.parseFloat(tripData.start_lat) : null;
    const start_lng = tripData.start_lng !== undefined ? Number.parseFloat(tripData.start_lng) : null;
    const end_lat = tripData.end_lat !== undefined ? Number.parseFloat(tripData.end_lat) : null;
    const end_lng = tripData.end_lng !== undefined ? Number.parseFloat(tripData.end_lng) : null;

    // Update profile (best-effort)
    try {
      await supabase.from('profiles').upsert({
        id: driver_id,
        full_name: driver_name,
        phone_number,
        car_model
      });
    } catch (e) {
      console.warn("Profile upsert warning:", e?.message || e);
    }

    const payload = {
      driver_id,
      driver_name,
      phone_number,
      car_model,
      from_city,
      to_city,
      departure_time,
      price,
      available_seats,
      start_lat: Number.isFinite(start_lat) ? start_lat : null,
      start_lng: Number.isFinite(start_lng) ? start_lng : null,
      end_lat: Number.isFinite(end_lat) ? end_lat : null,
      end_lng: Number.isFinite(end_lng) ? end_lng : null
    };

    const { data, error } = await supabase
      .from('trips')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Trip create error:", error.message);
      throw toServiceError(error, 400);
    }

    // ✅ Haydovchi uchun joyni yopish (Critical Fix: await qo'shildi)
    try {
      await this.bookSeat(
        data.id,
        {
          seat_number: 1,
          passenger_id: DRIVER_BLOCK,
          passenger_name: "Haydovchi",
          passenger_phone: phone_number
        },
        driver_id
      );
    } catch (e) {
      console.warn("Driver seat auto-block failed:", e?.message || e);
    }

    return data;
  }

  /**
   * 2) Search trips
   */
  async fetchAllTrips(from, to, date, passengers) {
    let query = supabase
      .from('trips')
      .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
      .order('departure_time', { ascending: true });

    if (from && from.trim() !== "") query = query.ilike('from_city', `%${from}%`);
    if (to && to.trim() !== "") query = query.ilike('to_city', `%${to}%`);

    if (date) {
      query = query
        .gte('departure_time', `${date}T00:00:00`)
        .lte('departure_time', `${date}T23:59:59`);
    }

    if (passengers) {
      const pCount = Number.parseInt(passengers, 10);
      if (!Number.isNaN(pCount)) query = query.gte('available_seats', pCount);
    }

    const { data, error } = await query;
    if (error) throw toServiceError(error, 400);
    return data;
  }

  async _getTripWithBookings(tripId) {
    const { data: trip, error } = await supabase
      .from('trips')
      .select(`*, bookings (seat_number, passenger_id, passenger_name, passenger_phone)`)
      .eq('id', tripId)
      .maybeSingle();

    if (error) throw toServiceError(error, 400);
    return trip;
  }

  /**
   * 3) Trip detail + generated_seats
   */
  async fetchTripById(tripId) {
    const trip = await this._getTripWithBookings(tripId);
    if (!trip) return null;

    const bookedSeats = trip.bookings || [];
    const totalSeats = (trip.available_seats || 0) + bookedSeats.length;

    const fullSeatsArray = [];
    for (let i = 1; i <= totalSeats; i++) {
      const booking = bookedSeats.find(b => Number.parseInt(b.seat_number, 10) === i);
      if (booking) {
        fullSeatsArray.push({
          seat_number: i,
          passenger_id: booking.passenger_id,
          passenger_name: booking.passenger_name,
          passenger_phone: booking.passenger_phone,
          status: booking.passenger_id === DRIVER_BLOCK ? 'BLOCKED' : 'BOOKED'
        });
      } else {
        fullSeatsArray.push({
          seat_number: i,
          passenger_id: null,
          passenger_name: null,
          passenger_phone: null,
          status: 'AVAILABLE'
        });
      }
    }
    return { ...trip, generated_seats: fullSeatsArray };
  }

  _resolveRequesterId(requesterId, bookingPassengerId) {
    return requesterId || bookingPassengerId || null;
  }

  /**
   * 4) Book seat
   */
  async bookSeat(tripId, bookingData, requesterId) {
    const seat_number = bookingData.seat_number ?? bookingData.seatNumber;
    const passenger_id = bookingData.passenger_id ?? bookingData.passengerId;
    const passenger_name = bookingData.passenger_name ?? bookingData.passengerName;
    const passenger_phone = bookingData.passenger_phone ?? bookingData.passengerPhone;

    const finalSeatNumber = toInt(seat_number, 'seat_number');
    const isDriverBlocking = passenger_id === DRIVER_BLOCK;

    const actualRequester = this._resolveRequesterId(requesterId, passenger_id);
    if (!actualRequester) throw new Error("userId topilmadi");

    const trip = await this._getTripWithBookings(tripId);
    if (!trip) throw new Error("Safar topilmadi");

    if (isDriverBlocking && trip.driver_id !== actualRequester) {
      throw new Error("Faqat haydovchi joyni yopishi mumkin");
    }

    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('trip_id', tripId)
      .eq('seat_number', finalSeatNumber)
      .maybeSingle();

    if (existing) throw new Error("Bu joy allaqachon band qilingan");

    if (!isDriverBlocking && (trip.available_seats || 0) <= 0) {
      throw new Error("Bo‘sh joy qolmagan");
    }

    const insertPayload = {
      trip_id: tripId,
      seat_number: finalSeatNumber,
      passenger_id: isDriverBlocking ? DRIVER_BLOCK : ensure(passenger_id, 'passenger_id'),
      passenger_name: isDriverBlocking ? "Yopilgan joy" : ensure(passenger_name, 'passenger_name'),
      passenger_phone: isDriverBlocking ? "" : (passenger_phone || "")
    };

    const { error: bookErr } = await supabase.from('bookings').insert([insertPayload]);
    if (bookErr) throw toServiceError(bookErr);

    if (!isDriverBlocking) {
      await supabase
        .from('trips')
        .update({ available_seats: (trip.available_seats || 0) - 1 })
        .eq('id', tripId);
    }

    return { success: true };
  }

  /**
   * 5) Cancel seat
   */
  async cancelSeat(tripId, cancelData, requesterId) {
    const seat_number = toInt(cancelData.seat_number ?? cancelData.seatNumber, 'seat_number');
    const trip = await this._getTripWithBookings(tripId);
    if (!trip) throw new Error("Safar topilmadi");

    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('trip_id', tripId)
      .eq('seat_number', seat_number)
      .maybeSingle();

    if (!booking) throw new Error("Band qilingan joy topilmadi");

    const { error: delErr } = await supabase
      .from('bookings')
      .delete()
      .eq('trip_id', tripId)
      .eq('seat_number', seat_number);

    if (delErr) throw toServiceError(delErr);

    if (booking.passenger_id !== DRIVER_BLOCK) {
      await supabase
        .from('trips')
        .update({ available_seats: (trip.available_seats || 0) + 1 })
        .eq('id', tripId);
    }

    return { success: true };
  }

  async fetchMyDriverTrips(userId) {
    const { data, error } = await supabase
      .from('trips')
      .select(`*, bookings (seat_number, passenger_id, passenger_name)`)
      .eq('driver_id', userId)
      .order('departure_time', { ascending: false });

    if (error) throw toServiceError(error, 400);
    return data;
  }

  async fetchMyBookings(userId) {
    const { data: bookings, error: bError } = await supabase
      .from('bookings')
      .select('trip_id')
      .eq('passenger_id', userId);

    if (bError) throw toServiceError(bError, 400);

    const tripIds = [...new Set((bookings || []).map(b => b.trip_id))];
    if (tripIds.length === 0) return [];

    const { data, error } = await supabase
      .from('trips')
      .select(`*, bookings (seat_number, passenger_id, passenger_name)`)
      .in('id', tripIds)
      .order('departure_time', { ascending: false });

    if (error) throw toServiceError(error, 400);
    return data;
  }
}

module.exports = new TripService();