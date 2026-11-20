import { useState } from "react";
import {
  CalendarRange,
  Check,
  Clock3,
  MapPin,
  SlidersHorizontal,
  TriangleAlert,
  Users,
} from "lucide-react";

import { listRooms } from "../api/client";
import type { Room } from "../api/types";
import { BookingForm } from "../components/BookingForm";
import { Button } from "../components/Button";
import { EmptyState, ErrorPanel } from "../components/StatePanel";
import { AvailabilityBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { useFetch } from "../hooks/useFetch";
import {
  addMinutes,
  formatClock,
  formatDateHeading,
  formatDateTimeInput,
  localDateKey,
  parseDateTimeInput,
  roundUpToNextHalfHour,
} from "../lib/datetime";

const DURATIONS = [30, 60, 90, 120];
const CAPACITIES = [4, 6, 8, 10, 12, 16, 20, 24];

function RoomCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton h-5 w-36" />
          <div className="skeleton h-3 w-28" />
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton mt-5 h-3 w-24" />
      <div className="mt-4 flex gap-2">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-5 w-20 rounded-full" />
      </div>
      <div className="mt-6 border-t border-slate-100 pt-4">
        <div className="skeleton h-8 w-full" />
      </div>
    </div>
  );
}

export function RoomsPage() {
  const [defaultStart] = useState(() => roundUpToNextHalfHour(new Date()));
  const [checkDate, setCheckDate] = useState(() => localDateKey(defaultStart));
  const [checkTime, setCheckTime] = useState(
    () => formatDateTimeInput(defaultStart).split("T")[1] ?? "09:00",
  );
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [minCapacity, setMinCapacity] = useState(0);
  const [facilities, setFacilities] = useState<Set<string>>(() => new Set());
  const [formRoom, setFormRoom] = useState<Room | null>(null);
  const notify = useToast();

  const checkStart = parseDateTimeInput(`${checkDate}T${checkTime}`) ?? new Date();
  const checkEnd = addMinutes(checkStart, durationMinutes);
  const isPast = checkStart.getTime() < Date.now();
  const facilityKey = [...facilities].sort().join(",");
  const queryKey = `${checkDate}|${checkTime}|${durationMinutes}|${minCapacity}|${facilityKey}`;

  const allRoomsState = useFetch(() => listRooms(), []);
  const roomsState = useFetch(
    () =>
      listRooms({
        start_at: checkStart.toISOString(),
        end_at: checkEnd.toISOString(),
        min_capacity: minCapacity || undefined,
        facility: [...facilities],
      }),
    [queryKey],
  );

  const rooms = roomsState.data ?? [];
  const allRooms = allRoomsState.data ?? rooms;
  const facilityOptions = Array.from(
    new Set(allRooms.flatMap((room) => room.facilities)),
  ).sort((a, b) => a.localeCompare(b));

  const activeFilters = minCapacity > 0 || facilities.size > 0;

  const toggleFacility = (facility: string) => {
    setFacilities((current) => {
      const next = new Set(current);
      if (next.has(facility)) next.delete(facility);
      else next.add(facility);
      return next;
    });
  };

  const clearFilters = () => {
    setMinCapacity(0);
    setFacilities(new Set());
  };

  const handleSaved = () => {
    setFormRoom(null);
    notify("Reservation created.");
    roomsState.refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Rooms</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Find the right room
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Check live availability for a time window, then reserve the room that fits the meeting.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          <span className="text-lg font-semibold text-slate-900 tabular-nums">
            {roomsState.data ? rooms.length : "—"}
          </span>{" "}
          {rooms.length === 1 ? "room" : "rooms"} match
        </p>
      </div>

      <section className="card p-4 sm:p-5" aria-labelledby="availability-filters">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-teal-700" aria-hidden="true" />
            <h2 id="availability-filters" className="text-sm font-semibold text-slate-900">
              Availability and filters
            </h2>
          </div>
          {activeFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="room-check-date">
              Date
            </label>
            <input
              id="room-check-date"
              type="date"
              className="input"
              value={checkDate}
              onChange={(event) => {
                if (event.target.value) setCheckDate(event.target.value);
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="room-check-time">
              Start time
            </label>
            <input
              id="room-check-time"
              type="time"
              className="input"
              value={checkTime}
              onChange={(event) => {
                if (event.target.value) setCheckTime(event.target.value);
              }}
              step={300}
            />
          </div>
          <div>
            <label className="label" htmlFor="room-check-duration">
              Duration
            </label>
            <select
              id="room-check-duration"
              className="input"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
            >
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="room-min-capacity">
              Minimum capacity
            </label>
            <select
              id="room-min-capacity"
              className="input"
              value={minCapacity}
              onChange={(event) => setMinCapacity(Number(event.target.value))}
            >
              <option value={0}>Any capacity</option>
              {CAPACITIES.map((capacity) => (
                <option key={capacity} value={capacity}>
                  {capacity}+ people
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="mt-4 border-t border-slate-200 pt-4">
          <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Facilities
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {facilityOptions.map((facility) => {
              const selected = facilities.has(facility);
              return (
                <button
                  key={facility}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleFacility(facility)}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    selected
                      ? "border-teal-600 bg-teal-50 text-teal-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                  {facility}
                </button>
              );
            })}
            {allRoomsState.loading && facilityOptions.length === 0 ? (
              <span className="text-xs text-slate-500">Loading facilities…</span>
            ) : null}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Showing availability for {formatDateHeading(checkDate)},{" "}
            <span className="tabular-nums">
              {formatClock(checkStart)}–{formatClock(checkEnd)}
            </span>
            .
          </span>
        </div>

        {isPast ? (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900"
          >
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            This window has already passed. Choose a future time to make a reservation.
          </div>
        ) : null}
      </section>

      {roomsState.error && !roomsState.data ? (
        <ErrorPanel message={roomsState.error} onRetry={roomsState.refetch} />
      ) : roomsState.loading && !roomsState.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <RoomCardSkeleton />
          <RoomCardSkeleton />
          <RoomCardSkeleton />
          <RoomCardSkeleton />
          <RoomCardSkeleton />
          <RoomCardSkeleton />
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No rooms match these filters"
          description="Widen the capacity or facility filters, or try another time window."
          action={
            activeFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {roomsState.error ? (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{roomsState.error}</span>
              <Button variant="secondary" size="sm" onClick={roomsState.refetch}>
                Retry
              </Button>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => {
              const unavailable = room.available === false;
              const disabled = isPast || unavailable;
              return (
                <article
                  key={room.id}
                  aria-labelledby={`room-${room.id}-name`}
                  className="card group flex flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        id={`room-${room.id}-name`}
                        className="truncate text-lg font-semibold tracking-tight text-slate-950"
                      >
                        {room.name}
                      </h2>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {room.location}
                      </p>
                    </div>
                    <AvailabilityBadge available={room.available} />
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {room.capacity} people
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {room.facilities.map((facility) => (
                      <span key={facility} className="chip">
                        {facility}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <p className="text-xs text-slate-500 tabular-nums">
                        {formatClock(checkStart)}–{formatClock(checkEnd)}
                      </p>
                      <Button
                        size="sm"
                        disabled={disabled}
                        onClick={() => setFormRoom(room)}
                        aria-label={`Reserve ${room.name}`}
                      >
                        {isPast ? "Past time" : unavailable ? "Booked" : "Reserve"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {formRoom ? (
        <BookingForm
          mode="create"
          rooms={allRooms}
          initial={{ roomId: formRoom.id, start: checkStart, end: checkEnd }}
          onClose={() => setFormRoom(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
