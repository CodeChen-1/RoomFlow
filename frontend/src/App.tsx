import { useEffect, useState } from 'react'
import {
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  DoorOpen,
  Globe2,
  LayoutDashboard,
  Plus,
  Shield,
  X,
} from 'lucide-react'
import { AdminPanel } from './AdminPanel'
import { BookingDialog } from './BookingDialog'
import type { DialogState } from './BookingDialog'
import { Dashboard, Directory, Schedule } from './Screens'
import {
  dateKey,
  dayBounds,
  initialSlot,
  localInstant,
  rangeQuery,
  request,
  timezone,
} from './domain'
import type { Booking, Room, Screen, Slot } from './domain'

const pages = [
  { name: 'Dashboard' as const, icon: LayoutDashboard },
  { name: 'Rooms' as const, icon: DoorOpen },
  { name: 'Reservations' as const, icon: CalendarDays },
  { name: 'Admin' as const, icon: Shield },
]

function currentPage(): Screen {
  return (
    pages.find(
      (p) => '#' + p.name.toLowerCase() === window.location.hash.toLowerCase(),
    )?.name ?? 'Dashboard'
  )
}

export default function App() {
  const [screen, setScreen] = useState(currentPage)
  const [date, setDate] = useState(() => dateKey())
  const [slot, setSlot] = useState<Slot>(() => initialSlot(dateKey()))
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [upcoming, setUpcoming] = useState<Booking[]>([])
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadedKey, setLoadedKey] = useState('')
  const [revision, setRevision] = useState(0)
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const [now, setNow] = useState(Date.now)
  const start = localInstant(slot.start)
  const end = localInstant(slot.end)
  const invalid =
    !start || !end
      ? 'Choose a valid start and end time to check availability.'
      : +end <= +start
        ? 'Available until must be later than Available from.'
        : ''
  const directoryRange = !invalid && start && end ? rangeQuery(start, end) : ''
  const overviewSlot = initialSlot(date)
  const overviewRange = rangeQuery(
    new Date(overviewSlot.start),
    new Date(overviewSlot.end),
  )
  const roomQuery = screen === 'Rooms' ? directoryRange : overviewRange
  const dataKey = [screen, date, roomQuery].join('|')
  const current = dataKey === loadedKey
  useEffect(() => {
    const changed = () => {
      setScreen(currentPage())
      setDialog(null)
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    const { start: dayStart, end: dayEnd } = dayBounds(date)
    setLoading(true)
    setError('')
    const options = { signal: controller.signal }
    Promise.all([
      request<Room[]>('rooms' + (roomQuery ? '?' + roomQuery : ''), options),
      screen === 'Rooms' || screen === 'Admin'
        ? Promise.resolve([] as Booking[])
        : request<Booking[]>(
            'bookings?' + rangeQuery(dayStart, dayEnd),
            options,
          ),
      screen === 'Dashboard'
        ? request<Booking[]>('bookings?upcoming=true&status=active', options)
        : Promise.resolve([] as Booking[]),
    ])
      .then(([loadedRooms, day, next]) => {
        if (controller.signal.aborted) return
        setRooms(loadedRooms)
        setBookings(day)
        setUpcoming(next)
        setLoadedKey(dataKey)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [dataKey, date, screen, roomQuery, revision, now])
  function navigate(target: Screen) {
    const hash = '#' + target.toLowerCase()
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
    setScreen(target)
    setDialog(null)
  }
  function saved(booking: Booking, message: string) {
    setDialog(null)
    setNotice(message)
    setDate(dateKey(new Date(booking.start_at)))
    if (booking.status === 'active') setScheduleVersion((v) => v + 1)
    navigate('Reservations')
    setRevision((r) => r + 1)
  }
  const details = (booking: Booking) => setDialog({ type: 'details', booking })
  const newBooking = (roomId?: number) =>
    setDialog({
      type: 'create',
      roomId,
      slot: screen === 'Rooms' && !invalid ? slot : initialSlot(date),
    })
  const displayDate = new Date(date + 'T12:00').toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="#dashboard" aria-label="RoomFlow home">
          <img src="/roomflow.svg" alt="" />
          RoomFlow
        </a>
        <nav aria-label="Main navigation" className="nav">
          {pages.map(({ name, icon: Icon }) => (
            <a
              key={name}
              href={'#' + name.toLowerCase()}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                navigate(name)
              }}
              aria-current={screen === name ? 'page' : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              {name}
            </a>
          ))}
        </nav>
        <div className="locale">
          <Globe2 size={16} aria-hidden="true" />
          {timezone}
        </div>
      </aside>
      <main id="main-content" tabIndex={-1}>
        <div className="topbar">
          <div className="crumb">
            <Building2 size={16} aria-hidden="true" />
            <span>Workspace</span>
            <ChevronRight size={13} aria-hidden="true" />
            <strong>{screen}</strong>
          </div>
          <button className="btn primary" onClick={() => newBooking()}>
            <Plus size={17} aria-hidden="true" />
            New reservation
          </button>
        </div>
        <div className="content">
          <header className="page-head">
            <div>
              <h1>
                {screen === 'Dashboard'
                  ? 'Workspace overview'
                  : screen === 'Rooms'
                    ? 'Room directory'
                    : screen === 'Admin'
                      ? 'Room management'
                      : 'Reservations'}
              </h1>
              <p className="subtle">
                {screen === 'Rooms'
                  ? 'Find a room for your next meeting.'
                  : screen === 'Admin'
                    ? 'Add, edit, or remove workspace rooms.'
                    : displayDate + ' · ' + timezone}
              </p>
            </div>
            {screen !== 'Rooms' && screen !== 'Admin' && (
              <input
                className="date-field"
                aria-label="Selected date"
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) setDate(e.target.value)
                }}
              />
            )}
          </header>
          {notice && (
            <div role="status" className="notice">
              <Check size={16} />
              {notice}
              <button
                className="icon-btn"
                aria-label="Dismiss message"
                onClick={() => setNotice('')}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="notice error">
              {error}
              <button className="btn" onClick={() => setRevision((r) => r + 1)}>
                Retry
              </button>
            </div>
          )}
          {screen === 'Rooms' && (
            <Directory
              rooms={rooms}
              slot={slot}
              setSlot={setSlot}
              book={newBooking}
              invalid={
                invalid || (error ? 'Room availability is unavailable.' : '')
              }
              loading={!current}
            />
          )}
          {screen === 'Dashboard' &&
            (current && !error ? (
              <Dashboard
                rooms={rooms}
                bookings={bookings}
                date={date}
                slot={overviewSlot}
                upcoming={upcoming}
                open={details}
              />
            ) : (
              loading && (
                <p className="loading" role="status">
                  Loading workspace…
                </p>
              )
            ))}
          {screen === 'Reservations' && !error && (
            <Schedule
              key={scheduleVersion}
              rooms={rooms}
              bookings={current ? bookings : []}
              date={date}
              open={details}
              pending={!current}
            />
          )}
          {screen === 'Admin' && (
            <AdminPanel
              rooms={rooms}
              onChanged={(message) => {
                setNotice(message)
                setRevision((r) => r + 1)
              }}
            />
          )}
        </div>
      </main>
      {dialog && (
        <BookingDialog
          key={dialog.type}
          state={dialog}
          rooms={rooms}
          close={() => setDialog(null)}
          change={setDialog}
          saved={saved}
        />
      )}
    </div>
  )
}
