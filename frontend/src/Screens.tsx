import { useState } from 'react'
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  DoorOpen,
  MapPin,
  UsersRound,
} from 'lucide-react'
import {
  clippedHours,
  clock,
  dateKey,
  dayBounds,
  intervalLabel,
  timezone,
} from './domain'
import type { Booking, Room, Slot } from './domain'

function RoomTile({ room }: { room: Room }) {
  return (
    <span aria-hidden="true" className={'tile tone-' + ((room.id - 1) % 5)}>
      <DoorOpen size={19} />
    </span>
  )
}

function Availability({ room }: { room: Room }) {
  return (
    <span className={'status ' + (room.available ? '' : 'busy')}>
      {room.available === null
        ? 'Unchecked'
        : room.available
          ? 'Available'
          : 'Reserved'}
    </span>
  )
}

function BookingRow({
  item,
  room,
  open,
  showDate = false,
}: {
  item: Booking
  room?: Room
  open: (b: Booking) => void
  showDate?: boolean
}) {
  return (
    <button className="list-row" onClick={() => open(item)}>
      {room && <RoomTile room={room} />}
      <span className="min-w-0">
        <strong>{item.title}</strong>
        <small>
          {intervalLabel(item.start_at, item.end_at, showDate)}
          {room ? ' · ' + room.name : ' · ' + item.organiser}
        </small>
      </span>
      <span className="row-tail">
        {item.status === 'cancelled' ? (
          <span className="status cancelled">Cancelled</span>
        ) : (
          <ChevronRight aria-hidden="true" size={15} />
        )}
      </span>
    </button>
  )
}

function Occupancy({
  bookings,
  date,
  total,
}: {
  bookings: Booking[]
  date: string
  total: number
}) {
  const { start, end } = dayBounds(date)
  const hours = Array.from(
    { length: Math.ceil((+end - +start) / 3600000) },
    (_, i) => {
      const begin = new Date(+start + i * 3600000)
      const finish = new Date(Math.min(+end, +begin + 3600000))
      const ratio = total
        ? (clippedHours(bookings, begin, finish) * 3600000) /
          ((+finish - +begin) * total)
        : 0
      return { begin, fraction: Math.min(1, ratio) }
    },
  )
  return (
    <section className="board" aria-label="Hourly room utilisation">
      <div className="board-heading">
        <div>
          <h2>Room utilisation</h2>
          <p className="subtle">Share of room time reserved each hour</p>
        </div>
        <span className="legend">Reserved</span>
      </div>
      <div className="chart">
        <div className="chart-bars">
          {hours.map(({ begin, fraction }) => (
            <span
              className="bar"
              title={
                clock(begin) + ' · ' + Math.round(fraction * 100) + '% reserved'
              }
              key={begin.toISOString()}
            >
              <span style={{ height: fraction * 100 + '%' }} />
            </span>
          ))}
        </div>
        <div className="axis" aria-hidden="true">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span key={t}>{clock(new Date(+start + t * (+end - +start)))}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

interface DashboardProps {
  rooms: Room[]
  bookings: Booking[]
  upcoming: Booking[]
  date: string
  slot: Slot
  open: (b: Booking) => void
}

export function Dashboard({
  rooms,
  bookings,
  upcoming,
  date,
  slot,
  open,
}: DashboardProps) {
  const active = bookings.filter((b) => b.status === 'active')
  const { start, end } = dayBounds(date)
  const hours = clippedHours(active, start, end)
  const stats = [
    { label: 'Active reservations', value: active.length, icon: CalendarDays },
    {
      label: 'Rooms booked',
      value: new Set(active.map((b) => b.room_id)).size,
      icon: DoorOpen,
    },
    {
      label: 'Reserved room-hours',
      value: Number(hours.toFixed(2)),
      icon: Clock3,
    },
  ]
  const next = upcoming
    .filter(
      (b) => b.status === 'active' && Date.parse(b.start_at) >= Date.now(),
    )
    .slice(0, 5)
  return (
    <>
      <section className="metrics" aria-label="Daily statistics">
        {stats.map(({ label, value, icon: Icon }) => (
          <div className="metric" key={label}>
            <div className="metric-icon">
              <Icon aria-hidden="true" size={17} />
            </div>
            <dl>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </dl>
          </div>
        ))}
      </section>
      <Occupancy date={date} bookings={active} total={rooms.length} />
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-heading">
            <h2>Upcoming reservations</h2>
            <a className="text-action" href="#reservations">
              Schedule <ArrowUpRight size={14} />
            </a>
          </div>
          {next.length ? (
            next.map((b) => (
              <BookingRow
                key={b.id}
                item={b}
                room={rooms.find((r) => r.id === b.room_id)}
                open={open}
                showDate
              />
            ))
          ) : (
            <p className="empty">
              No upcoming reservations. Select New reservation to book a room.
            </p>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Room availability</h2>
            <a className="text-action" href="#rooms">
              Directory <ArrowUpRight size={14} />
            </a>
          </div>
          <p className="subtle mb-2">
            {intervalLabel(slot.start, slot.end, true)}
          </p>
          {rooms.map((r) => (
            <div className="list-row" key={r.id}>
              <RoomTile room={r} />
              <span>
                <strong>{r.name}</strong>
                <small>{r.location}</small>
              </span>
              <span className="row-tail">
                <Availability room={r} />
              </span>
            </div>
          ))}
          {!rooms.length && <p className="empty">No rooms in the directory.</p>}
        </section>
      </div>
    </>
  )
}

interface DirectoryProps {
  rooms: Room[]
  slot: Slot
  setSlot: (s: Slot) => void
  book: (roomId: number) => void
  invalid: string
  loading: boolean
}
export function Directory({
  rooms,
  slot,
  setSlot,
  book,
  invalid,
  loading,
}: DirectoryProps) {
  const [capacity, setCapacity] = useState('')
  const [facility, setFacility] = useState('')
  const facilities = [...new Set(rooms.flatMap((r) => r.facilities))].sort()
  const filtered = rooms.filter(
    (r) =>
      r.capacity >= Number(capacity) &&
      (!facility || r.facilities.includes(facility)),
  )
  return (
    <>
      <div className="filter-box">
        <label className="field time-field">
          Available from
          <input
            type="datetime-local"
            value={slot.start}
            onChange={(e) => setSlot({ ...slot, start: e.target.value })}
          />
        </label>
        <label className="field time-field">
          Available until
          <input
            type="datetime-local"
            value={slot.end}
            onChange={(e) => setSlot({ ...slot, end: e.target.value })}
          />
        </label>
        <label className="field">
          Minimum capacity
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Any capacity"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </label>
        <label className="field">
          Facility
          <select
            aria-label="Facility"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
          >
            <option value="">All facilities</option>
            {facilities.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>
      {invalid ? (
        <p className="notice error" role="alert">
          {invalid}
        </p>
      ) : loading ? (
        <p role="status" className="loading">
          Checking availability…
        </p>
      ) : (
        <>
          <div className="section-heading">
            <h2>
              {filtered.length} {filtered.length === 1 ? 'room' : 'rooms'}
            </h2>
            <span className="subtle">{timezone}</span>
          </div>
          <div className="room-grid">
            {filtered.map((r) => (
              <article className="room-card" key={r.id}>
                <div className="room-top">
                  <RoomTile room={r} />
                  <Availability room={r} />
                </div>
                <h2>{r.name}</h2>
                <p className="room-facts">
                  <MapPin size={14} />
                  {r.location}
                  <span aria-hidden="true">·</span>
                  <UsersRound size={14} />
                  {r.capacity} seats
                </p>
                <div className="tags">
                  {r.facilities.map((f) => (
                    <span key={f} className="tag">
                      {f}
                    </span>
                  ))}
                </div>
                <button
                  className="btn"
                  disabled={!r.available}
                  aria-label={'Book ' + r.name}
                  onClick={() => book(r.id)}
                >
                  {r.available ? 'Book room' : 'Reserved for this time'}
                  {r.available && <ArrowUpRight size={15} />}
                </button>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <p className="empty">
              No rooms match these filters. Try a smaller capacity or another
              facility.
            </p>
          )}
        </>
      )}
    </>
  )
}

export function Schedule({
  rooms,
  bookings,
  date,
  open,
  pending,
}: Pick<DashboardProps, 'rooms' | 'bookings' | 'date' | 'open'> & {
  pending: boolean
}) {
  const [filter, setFilter] = useState('')
  const [cancelled, setCancelled] = useState(false)
  const visible = bookings.filter(
    (b) =>
      (cancelled || b.status === 'active') &&
      (!filter || String(b.room_id) === filter),
  )
  return (
    <>
      <div className="filter-box">
        <label className="field max-w-xs">
          Filter by room
          <select aria-label="Filter by room" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All rooms</option>
            {rooms.map((r) => (
              <option value={r.id} key={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={cancelled}
            onChange={(e) => setCancelled(e.target.checked)}
          />
          Show cancelled
        </label>
      </div>
      {pending ? (
        <p className="loading" role="status">
          Loading schedule…
        </p>
      ) : (
        <>
          <div className="section-heading">
            <h2>
              {date === dateKey() ? 'Today’s schedule' : 'Daily schedule'}
            </h2>
            <span className="subtle">
              {visible.length}{' '}
              {visible.length === 1 ? 'reservation' : 'reservations'}
            </span>
          </div>
          {!visible.length && (
            <div className="panel">
              <p className="empty">
                No reservations for this date and room selection.
              </p>
            </div>
          )}
          {rooms.map((r) => {
            const group = visible.filter((b) => b.room_id === r.id)
            return (
              group.length > 0 && (
                <section className="room-group" key={r.id}>
                  <div className="section-heading">
                    <h2>{r.name}</h2>
                    <span className="subtle">{r.location}</span>
                  </div>
                  {group.map((b) => (
                    <BookingRow key={b.id} item={b} open={open} />
                  ))}
                </section>
              )
            )
          })}
        </>
      )}
    </>
  )
}
