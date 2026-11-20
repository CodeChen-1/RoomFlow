import { useEffect, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Plus,
  TriangleAlert,
} from "lucide-react";

import { listBookings, listRooms } from "../api/client";
import type { Booking, Room } from "../api/types";
import { BookingDetails } from "../components/BookingDetails";
import { BookingForm } from "../components/BookingForm";
import { Button } from "../components/Button";
import { ConfirmCancel } from "../components/ConfirmCancel";
import { DateNavigator } from "../components/DateNavigator";
import { EmptyState, ErrorPanel, LoadingPanel } from "../components/StatePanel";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { useFetch } from "../hooks/useFetch";
import {
  addMinutes,
  dateFromKey,
  dayBounds,
  defaultStartForDate,
  formatDateHeading,
  formatDateShort,
  formatDuration,
  formatTime,
  formatTimeRange,
  localDateKey,
  minutesBetween,
  relativeDayLabel,
  todayKey,
} from "../lib/datetime";

type View = "day" | "upcoming";

interface ReservationsPageProps {
  initialDate?: string;
}

interface ScheduleData {
  scope: string;
  bookings: Booking[];
}

interface BookingRowProps {
  booking: Booking;
  room?: Room;
  showRoom?: boolean;
  onSelect: (booking: Booking) => void;
}

function BookingRow({ booking, room, showRoom = false, onSelect }: BookingRowProps) {
  const cancelled = booking.status === "cancelled";
  const roomName = room?.name ?? `Room ${booking.room_id}`;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(booking)}
        aria-haspopup="dialog"
        aria-label={`${booking.title}, ${roomName}, ${formatTimeRange(booking.start_at, booking.end_at)}${
          cancelled ? ", cancelled" : ""
        }`}
        className="group flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50"
      >
        <span className="w-[5.5rem] shrink-0 pt-0.5 text-xs font-semibold text-slate-900 tabular-nums">
          <span className="block">{formatTime(booking.start_at)}</span>
          <span className="mt-0.5 block text-[11px] font-medium text-slate-400">
            to {formatTime(booking.end_at)}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`truncate text-sm font-semibold ${
                cancelled ? "text-slate-500" : "text-slate-900"
              }`}
            >
              {booking.title}
            </span>
            {cancelled ? <StatusBadge status="cancelled" /> : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {showRoom ? `${roomName} - ${booking.organiser}` : booking.organiser}
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-2 pt-0.5 text-[11px] font-medium text-slate-400 sm:flex">
          {formatDuration(minutesBetween(booking.start_at, booking.end_at))}
          <ChevronRight
            className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-teal-700"
            aria-hidden="true"
          />
        </span>
      </button>
    </li>
  );
}

function RoomGroup({
  roomId,
  room,
  bookings,
  onSelect,
}: {
  roomId: number;
  room?: Room;
  bookings: Booking[];
  onSelect: (booking: Booking) => void;
}) {
  const name = room?.name ?? `Room ${roomId}`;
  const headingId = `day-room-${roomId}`;

  return (
    <section className="card overflow-hidden" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={headingId} className="truncate text-sm font-semibold text-slate-950">
            {name}
          </h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {room ? `${room.location} - ${room.capacity} people` : "Room details unavailable"}
          </p>
        </div>
        <span className="chip">
          {bookings.length} {bookings.length === 1 ? "reservation" : "reservations"}
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {bookings.map((booking) => (
          <BookingRow key={booking.id} booking={booking} room={room} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
}

export function ReservationsPage({ initialDate }: ReservationsPageProps) {
  const [view, setView] = useState<View>("day");
  const [dateKey, setDateKey] = useState(initialDate ?? todayKey());
  const [roomFilter, setRoomFilter] = useState(0);
  const [showCancelled, setShowCancelled] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [formState, setFormState] = useState<
    { mode: "create" } | { mode: "edit"; booking: Booking } | null
  >(null);
  const notify = useToast();

  useEffect(() => {
    if (initialDate) setDateKey(initialDate);
  }, [initialDate]);

  const day = dayBounds(dateKey);
  const scope =
    view === "day" ? `day:${dateKey}:${roomFilter}` : `upcoming:${roomFilter}`;

  const roomsState = useFetch(() => listRooms(), []);
  const state = useFetch<ScheduleData>(async () => {
    if (view === "day") {
      const bookings = await listBookings({
        start_at: day.start.toISOString(),
        end_at: day.end.toISOString(),
        room_id: roomFilter || undefined,
      });
      return { scope, bookings };
    }

    const bookings = await listBookings({
      upcoming: true,
      room_id: roomFilter || undefined,
    });
    return { scope, bookings };
  }, [scope]);

  const rooms = roomsState.data ?? [];
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const current = state.data && state.data.scope === scope ? state.data : null;
  const bookings = current?.bookings ?? [];
  const loading = state.loading || !current;

  const visibleBookings =
    view === "day"
      ? bookings.filter((booking) => showCancelled || booking.status === "active")
      : bookings;

  const dayGroups = (() => {
    const byRoom = new Map<number, Booking[]>();
    for (const booking of visibleBookings) {
      const list = byRoom.get(booking.room_id) ?? [];
      list.push(booking);
      byRoom.set(booking.room_id, list);
    }
    return Array.from(byRoom.entries())
      .map(([roomId, items]) => ({
        roomId,
        room: roomsById.get(roomId),
        bookings: items.sort(
          (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        ),
      }))
      .sort((a, b) => {
        const aName = a.room?.name ?? `Room ${a.roomId}`;
        const bName = b.room?.name ?? `Room ${b.roomId}`;
        return aName.localeCompare(bName);
      });
  })();

  const upcomingGroups = (() => {
    const byDate = new Map<string, Booking[]>();
    for (const booking of visibleBookings) {
      const key = localDateKey(new Date(booking.start_at));
      const list = byDate.get(key) ?? [];
      list.push(booking);
      byDate.set(key, list);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({
        key,
        bookings: items.sort(
          (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        ),
      }));
  })();

  const activeCount = bookings.filter((booking) => booking.status === "active").length;
  const cancelledCount = bookings.length - activeCount;

  const openCreate = () => {
    setFormState({ mode: "create" });
  };

  const handleSaved = (saved: Booking, mode: "create" | "edit") => {
    setFormState(null);
    setSelected(saved);
    setDateKey(localDateKey(new Date(saved.start_at)));
    notify(mode === "create" ? "Reservation created." : "Reservation updated.");
    state.refetch();
  };

  const handleCancelled = (cancelled: Booking) => {
    setCancelTarget(null);
    setSelected(cancelled);
    notify("Reservation cancelled.");
    state.refetch();
  };

  const handleSelect = (booking: Booking) => {
    setSelected(booking);
  };

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Schedule</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          Reservations
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          Review the day room by room, or scan everything coming up next.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-xl border border-slate-300 bg-white p-1 shadow-sm"
          role="group"
          aria-label="Reservation view"
        >
          <button
            type="button"
            aria-pressed={view === "day"}
            onClick={() => setView("day")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              view === "day"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Day
          </button>
          <button
            type="button"
            aria-pressed={view === "upcoming"}
            onClick={() => setView("upcoming")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              view === "upcoming"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Upcoming
          </button>
        </div>
        <Button onClick={openCreate} disabled={rooms.length === 0}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New reservation
        </Button>
      </div>
    </div>
  );

  if (state.error && !current) {
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

      <section className="card p-4 sm:p-5" aria-label="Schedule controls">
        <div className="flex flex-wrap items-end gap-3">
          {view === "day" ? (
            <DateNavigator value={dateKey} onChange={setDateKey} />
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-600">
              <Clock3 className="h-4 w-4 text-teal-700" aria-hidden="true" />
              From now onward
            </div>
          )}

          <div>
            <label className="label" htmlFor="schedule-room-filter">
              Room
            </label>
            <select
              id="schedule-room-filter"
              className="input min-w-44"
              value={roomFilter}
              onChange={(event) => setRoomFilter(Number(event.target.value))}
            >
              <option value={0}>All rooms</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          {view === "day" ? (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-400">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                checked={showCancelled}
                onChange={(event) => setShowCancelled(event.target.checked)}
              />
              Show cancelled
            </label>
          ) : null}

          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            {loading ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-teal-700" aria-hidden="true" />
            ) : null}
            <span>
              {view === "day" ? (
                <>
                  <span className="font-semibold text-slate-900 tabular-nums">{activeCount}</span>{" "}
                  active
                  {showCancelled && cancelledCount > 0 ? (
                    <>
                      {" "}
                      - <span className="tabular-nums">{cancelledCount}</span> cancelled
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {bookings.length}
                  </span>{" "}
                  upcoming
                </>
              )}
            </span>
          </div>
        </div>
      </section>

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

      {roomsState.error ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
        >
          <TriangleAlert className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="flex-1">Room details could not be loaded. {roomsState.error}</span>
          <Button variant="secondary" size="sm" onClick={roomsState.refetch}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading ? (
        <LoadingPanel label={view === "day" ? "Loading the day's schedule" : "Loading upcoming reservations"} />
      ) : view === "day" ? (
        dayGroups.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="No reservations for this day"
            description={
              activeCount === 0 && cancelledCount > 0 && !showCancelled
                ? "Only cancelled reservations fall on this date. Show cancelled to review them."
                : "The selected rooms are free. Create a reservation to claim a time."
            }
            action={
              activeCount === 0 && cancelledCount > 0 && !showCancelled ? (
                <Button variant="secondary" onClick={() => setShowCancelled(true)}>
                  Show cancelled
                </Button>
              ) : (
                <Button onClick={openCreate} disabled={rooms.length === 0}>
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  New reservation
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {formatDateHeading(dateKey)}
              </h2>
              <p className="text-xs text-slate-500">
                {dayGroups.reduce((total, group) => total + group.bookings.length, 0)} shown
              </p>
            </div>
            <div className="space-y-4">
              {dayGroups.map((group) => (
                <RoomGroup
                  key={group.roomId}
                  roomId={group.roomId}
                  room={group.room}
                  bookings={group.bookings}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </>
        )
      ) : upcomingGroups.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing coming up"
          description="There are no active reservations from now onward. Create one to get started."
          action={
            <Button onClick={openCreate} disabled={rooms.length === 0}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              New reservation
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {upcomingGroups.map((group) => {
            const relative = relativeDayLabel(group.key);
            const isRelative = relative === "Today" || relative === "Tomorrow";
            return (
              <section key={group.key} aria-labelledby={`upcoming-${group.key}`}>
                <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                  <h2
                    id={`upcoming-${group.key}`}
                    className="text-sm font-semibold text-slate-900"
                  >
                    {relative}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isRelative ? `${formatDateShort(dateFromKey(group.key))} - ` : ""}
                    {group.bookings.length}{" "}
                    {group.bookings.length === 1 ? "reservation" : "reservations"}
                  </p>
                </div>
                <div className="card overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {group.bookings.map((booking) => (
                      <BookingRow
                        key={booking.id}
                        booking={booking}
                        room={roomsById.get(booking.room_id)}
                        showRoom
                        onSelect={handleSelect}
                      />
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selected ? (
        <BookingDetails
          booking={selected}
          room={roomsById.get(selected.room_id)}
          onClose={() => setSelected(null)}
          onEdit={() => {
            const current = selected;
            setSelected(null);
            setFormState({ mode: "edit", booking: current });
          }}
          onCancel={() => {
            const current = selected;
            setSelected(null);
            setCancelTarget(current);
          }}
        />
      ) : null}

      {formState ? (
        <BookingForm
          mode={formState.mode}
          rooms={rooms}
          bookingId={formState.mode === "edit" ? formState.booking.id : undefined}
          initial={
            formState.mode === "edit"
              ? {
                  title: formState.booking.title,
                  organiser: formState.booking.organiser,
                  roomId: formState.booking.room_id,
                  start: new Date(formState.booking.start_at),
                  end: new Date(formState.booking.end_at),
                }
              : {
                  roomId: roomFilter || null,
                  start: defaultStartForDate(dateKey),
                  end: addMinutes(defaultStartForDate(dateKey), 60),
                }
          }
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {cancelTarget ? (
        <ConfirmCancel
          booking={cancelTarget}
          roomName={roomsById.get(cancelTarget.room_id)?.name ?? `Room ${cancelTarget.room_id}`}
          onClose={() => setCancelTarget(null)}
          onCancelled={handleCancelled}
        />
      ) : null}
    </div>
  );
}
