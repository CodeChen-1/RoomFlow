export interface Room {
  id: number
  name: string
  capacity: number
  location: string
  facilities: string[]
  available: boolean | null
}

export interface Booking {
  id: number
  room_id: number
  title: string
  organiser: string
  start_at: string
  end_at: string
  status: 'active' | 'cancelled'
  created_at: string
  updated_at: string
}

export type BookingInput = Pick<
  Booking,
  'room_id' | 'title' | 'organiser' | 'start_at' | 'end_at'
>
export type Screen = 'Dashboard' | 'Rooms' | 'Reservations' | 'Admin'
export type Slot = { start: string; end: string }

export const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
const pad = (n: number) => String(n).padStart(2, '0')

export function dateKey(d = new Date()) {
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-')
}

export function localInput(d: Date) {
  return dateKey(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

export function localInstant(value: string) {
  const d = new Date(value)
  return Number.isFinite(d.getTime()) && localInput(d) === value ? d : undefined
}

export function dayBounds(date: string) {
  const start = new Date(date + 'T00:00')
  const nextCalendarDate = new Date(date + 'T00:00:00Z')
  nextCalendarDate.setUTCDate(nextCalendarDate.getUTCDate() + 1)
  const end = new Date(nextCalendarDate.toISOString().split('T')[0] + 'T00:00')
  return { start, end }
}

export function initialSlot(date: string): Slot {
  const current = new Date()
  let start =
    date === dateKey(current)
      ? new Date(Math.ceil((current.getTime() + 1) / 900000) * 900000)
      : new Date(date + 'T09:00')
  let end = new Date(start.getTime() + 3600000)
  while (
    +new Date(localInput(start)) !== +start ||
    +new Date(localInput(end)) !== +end
  ) {
    start = new Date(+start + 900000)
    end = new Date(+start + 3600000)
  }
  return { start: localInput(start), end: localInput(end) }
}

export function clippedHours(bookings: Booking[], start: Date, end: Date) {
  return (
    bookings.reduce(
      (sum, b) =>
        sum +
        Math.max(
          0,
          Math.min(Date.parse(b.end_at), end.getTime()) -
            Math.max(Date.parse(b.start_at), start.getTime()),
        ),
      0,
    ) / 3600000
  )
}

export function clock(value: string | Date) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function shortDate(value: string | Date) {
  const day = new Date(value)
  return day.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: day.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

export function intervalLabel(from: string, until: string, showDate = false) {
  const start = new Date(from)
  const end = new Date(until)
  const crossesMidnight = dateKey(start) !== dateKey(end)
  const firstDay = showDate || crossesMidnight ? shortDate(start) + ' · ' : ''
  const lastDay = crossesMidnight ? shortDate(end) + ' · ' : ''
  return firstDay + clock(start) + ' – ' + lastDay + clock(end)
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch('/api/' + path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new Error(
      'Cannot reach RoomFlow. Check that the local API is running, then try again.',
    )
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      body.error?.message ||
        (response.status === 409
          ? 'This room is already reserved for part of that time. Choose a different time or room.'
          : 'RoomFlow could not complete that request. Please try again.'),
    )
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export function rangeQuery(start: Date, end: Date) {
  return new URLSearchParams({
    start_at: start.toISOString(),
    end_at: end.toISOString(),
  }).toString()
}
