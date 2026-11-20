import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarClock,
  Clock3,
  DoorOpen,
  Plus,
  TriangleAlert,
} from "lucide-react";

import { listBookings, listRooms } from "../api/client";
import type { Room } from "../api/types";
import { AvailabilityStrip } from "../components/AvailabilityStrip";
import { BookingForm } from "../components/BookingForm";
import { Button } from "../components/Button";
import { DateNavigator } from "../components/DateNavigator";
import { ErrorPanel } from "../components/StatePanel";
import { useToast } from "../components/Toast";
import { useFetch } from "../hooks/useFetch";
import { computeDayStats } from "../lib/dashboard";
import {
  addMinutes,
  dayBounds,
  defaultStartForDate,
  formatDateHeading,
  formatDateShort,
  formatHours,
  formatTime,
  formatTimeRange,
  localDateKey,
  timezoneLabel,
  todayKey,
} from "../lib/datetime";

interface DashboardData {
  rooms: Room[];
  dayBookings: Awaited<ReturnType<typeof listBookings>>;
  upcoming: Awaited<ReturnType<typeof listBookings>>;
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof CalendarCheck2;
}) {
  return (
    <div className="card relative overflow-hidden p-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-teal-600/80" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-9 w-9 rounded-xl" />
      </div>
      <div className="skeleton mt-4 h-8 w-20" />
      <div className="skeleton mt-2 h-3 w-28" />
    </div>
  );
}

export function DashboardPage() {
  const [dateKey, setDateKey] = useState(todayKey());
  const [formInitial, setFormInitial] = useState<{
    start: Date;
    end: Date;
    roomId: number | null;
  } | null>(null);
  const notify = useToast();
  const day = dayBounds(dateKey);

  const state = useFetch<DashboardData>(async () => {
    const [rooms, dayBookings, upcoming] = await Promise.all([
      listRooms(),
      listBookings({
        start_at: day.start.toISOString(),
        end_at: day.end.toISOString(),
      }),
      listBookings({ upcoming: true }),
    ]);
    return { rooms, dayBookings, upcoming };
  }, [dateKey]);

  const data = state.data;
  const stats = data
    ? computeDayStats(data.dayBookings, day.start, day.end, data.rooms.length)
    : null;
  const rooms = data?.rooms ?? [];
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const upcoming = data?.upcoming.slice(0, 5) ?? [];

  const openCreate = () => {
    const start = defaultStartForDate(dateKey);
    setFormInitial({ start, end: addMinutes(start, 60), roomId: null });
  };

  const handleSaved = () => {
    setFormInitial(null);
    notify("Reservation created.");
    state.refetch();
  };

  const header = (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          The day at a glance
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {formatDateHeading(dateKey)} · {timezoneLabel()}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DateNavigator value={dateKey} onChange={setDateKey} />
        <Button onClick={openCreate} disabled={!data}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New reservation
        </Button>
      </div>
    </div>
  );

  if (state.error && !data) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorPanel message={state.error} onRetry={state.refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {state.error ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{state.error}</span>
          <Button variant="secondary" size="sm" onClick={state.refetch}>
            Retry
          </Button>
        </div>
      ) : null}

      {stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active reservations"
            value={stats.count}
            detail="Overlapping this date"
            icon={CalendarCheck2}
          />
          <StatCard
            label="Rooms in use"
            value={`${stats.roomsUsed}/${rooms.length}`}
            detail="At least one booking"
            icon={Building2}
          />
          <StatCard
            label="Room-hours reserved"
            value={formatHours(stats.roomHours)}
            detail="Clipped to this date"
            icon={Clock3}
          />
          <StatCard
            label="Free rooms"
            value={stats.freeRooms}
            detail="No active bookings"
            icon={DoorOpen}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="card overflow-hidden" aria-labelledby="availability-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="availability-heading" className="font-semibold tracking-tight text-slate-950">
                Room availability
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">8am–6pm · local time</p>
            </div>
            <a
              href="#/rooms"
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition hover:text-teal-900"
            >
              Browse rooms
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          {stats ? (
            rooms.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {rooms.map((room) => {
                  const intervals = stats.byRoom.get(room.id) ?? [];
                  const hours =
                    intervals.reduce((total, interval) => total + interval.end - interval.start, 0) /
                    3_600_000;
                  return (
                    <div
                      key={room.id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(8rem,0.9fr)_minmax(0,1.6fr)_auto] sm:items-center sm:gap-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{room.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{room.capacity} people</p>
                      </div>
                      <AvailabilityStrip
                        bookings={data?.dayBookings ?? []}
                        roomId={room.id}
                        roomName={room.name}
                        dayStart={day.start}
                      />
                      <p className="text-xs text-slate-500 sm:text-right">
                        {intervals.length === 0
                          ? "Free all day"
                          : `${intervals.length} booking${intervals.length === 1 ? "" : "s"} · ${formatHours(hours)}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="px-5 py-8 text-sm text-slate-500">No rooms are configured yet.</p>
            )
          ) : (
            <div className="space-y-4 p-5">
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-4/5" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          )}
        </section>

        <section className="card overflow-hidden" aria-labelledby="upcoming-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="upcoming-heading" className="font-semibold tracking-tight text-slate-950">
                Upcoming reservations
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Next five from now</p>
            </div>
            <a
              href="#/reservations"
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition hover:text-teal-900"
            >
              Schedule
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          {upcoming.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((booking) => {
                const room = roomsById.get(booking.room_id);
                return (
                  <li key={booking.id}>
                    <a
                      href={`#/reservations?date=${localDateKey(new Date(booking.start_at))}`}
                      className="group flex items-start gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                    >
                      <span className="grid w-14 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {formatDateShort(booking.start_at)}
                        </span>
                        <span className="block text-xs font-semibold text-slate-900 tabular-nums">
                          {formatTime(booking.start_at)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {booking.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {room?.name ?? `Room ${booking.room_id}`} · {booking.organiser}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500 tabular-nums">
                          {formatTimeRange(booking.start_at, booking.end_at)}
                        </span>
                      </span>
                      <ArrowRight
                        className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-teal-700"
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                <CalendarClock className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-900">Nothing coming up</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Use New reservation to claim the next open slot.
              </p>
            </div>
          )}
        </section>
      </div>

      {formInitial ? (
        <BookingForm
          mode="create"
          rooms={rooms}
          initial={formInitial}
          onClose={() => setFormInitial(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
