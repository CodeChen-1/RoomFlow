import type { Booking } from "../api/types";

export interface DayInterval {
  start: number;
  end: number;
}

export interface DayStats {
  activeBookings: Booking[];
  count: number;
  roomsUsed: number;
  roomHours: number;
  freeRooms: number;
  byRoom: Map<number, DayInterval[]>;
}

export function clippedInterval(
  booking: Booking,
  dayStart: Date,
  dayEnd: Date,
): DayInterval | null {
  const start = Math.max(new Date(booking.start_at).getTime(), dayStart.getTime());
  const end = Math.min(new Date(booking.end_at).getTime(), dayEnd.getTime());
  return start < end ? { start, end } : null;
}

export function activeBookingsOnDay(
  bookings: Booking[],
  dayStart: Date,
  dayEnd: Date,
): Booking[] {
  return bookings
    .filter(
      (booking) =>
        booking.status === "active" &&
        new Date(booking.start_at).getTime() < dayEnd.getTime() &&
        new Date(booking.end_at).getTime() > dayStart.getTime(),
    )
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
}

export function computeDayStats(
  bookings: Booking[],
  dayStart: Date,
  dayEnd: Date,
  roomCount: number,
): DayStats {
  const activeBookings = activeBookingsOnDay(bookings, dayStart, dayEnd);
  const byRoom = new Map<number, DayInterval[]>();
  let totalMs = 0;

  for (const booking of activeBookings) {
    const interval = clippedInterval(booking, dayStart, dayEnd);
    if (!interval) continue;
    totalMs += interval.end - interval.start;
    const roomIntervals = byRoom.get(booking.room_id) ?? [];
    roomIntervals.push(interval);
    byRoom.set(booking.room_id, roomIntervals);
  }

  return {
    activeBookings,
    count: activeBookings.length,
    roomsUsed: byRoom.size,
    roomHours: totalMs / 3_600_000,
    freeRooms: Math.max(0, roomCount - byRoom.size),
    byRoom,
  };
}
