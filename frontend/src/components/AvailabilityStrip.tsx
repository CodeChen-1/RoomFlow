import type { Booking } from "../api/types";
import { formatTimeRange, localDateKey } from "../lib/datetime";

interface AvailabilityStripProps {
  bookings: Booking[];
  roomId: number;
  roomName: string;
  dayStart: Date;
}

const START_HOUR = 8;
const END_HOUR = 18;

export function AvailabilityStrip({
  bookings,
  roomId,
  roomName,
  dayStart,
}: AvailabilityStripProps) {
  const windowStart = new Date(dayStart);
  windowStart.setHours(START_HOUR, 0, 0, 0);
  const windowEnd = new Date(dayStart);
  windowEnd.setHours(END_HOUR, 0, 0, 0);
  const span = windowEnd.getTime() - windowStart.getTime();

  const roomBookings = bookings.filter(
    (booking) => booking.status === "active" && booking.room_id === roomId,
  );

  const bars = roomBookings
    .map((booking) => {
      const start = Math.max(new Date(booking.start_at).getTime(), windowStart.getTime());
      const end = Math.min(new Date(booking.end_at).getTime(), windowEnd.getTime());
      if (start >= end) return null;
      return {
        id: booking.id,
        left: ((start - windowStart.getTime()) / span) * 100,
        width: Math.max(((end - start) / span) * 100, 0.7),
        label: `${booking.title} · ${formatTimeRange(booking.start_at, booking.end_at)}`,
      };
    })
    .filter((bar): bar is NonNullable<typeof bar> => bar !== null);

  const now = new Date();
  const showNow =
    localDateKey(dayStart) === localDateKey(now) &&
    now.getTime() >= windowStart.getTime() &&
    now.getTime() <= windowEnd.getTime();
  const nowLeft = ((now.getTime() - windowStart.getTime()) / span) * 100;

  return (
    <div
      role="img"
      aria-label={`${roomName}: ${roomBookings.length} active ${
        roomBookings.length === 1 ? "reservation" : "reservations"
      } between 8am and 6pm`}
      className={`relative h-3 overflow-hidden rounded-full ${
        bars.length === 0 ? "bg-emerald-50" : "bg-slate-100"
      }`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(to right, transparent 0, transparent calc(10% - 1px), rgba(100,116,139,0.18) calc(10% - 1px), rgba(100,116,139,0.18) 10%)",
      }}
    >
      {bars.map((bar) => (
        <span
          key={bar.id}
          title={bar.label}
          className="absolute inset-y-0 rounded-full bg-teal-600/80 transition hover:bg-teal-700"
          style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
        />
      ))}
      {showNow ? (
        <span
          className="absolute inset-y-0 w-0.5 bg-slate-900"
          style={{ left: `${nowLeft}%` }}
          title="Current time"
        />
      ) : null}
    </div>
  );
}
