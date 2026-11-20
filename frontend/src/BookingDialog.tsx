import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Clock3, X } from 'lucide-react'
import { clock, localInput, localInstant, request, timezone } from './domain'
import type { Booking, BookingInput, Room, Slot } from './domain'

export type DialogState =
  | { type: 'create'; roomId?: number; slot: Slot }
  | { type: 'details' | 'edit' | 'cancel'; booking: Booking }

function Modal({
  title,
  close,
  children,
  busy,
}: {
  title: string
  close: () => void
  children: ReactNode
  busy: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = ref.current!
    element.showModal()
    return () => element.close()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) close()
      }}
    >
      <div className="dialog-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={close}
          disabled={busy}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

interface Props {
  state: DialogState
  rooms: Room[]
  close: () => void
  change: (state: DialogState) => void
  saved: (booking: Booking, message: string) => void
}

export function BookingDialog({ state, rooms, close, change, saved }: Props) {
  const booking = 'booking' in state ? state.booking : null
  const initial =
    state.type === 'create'
      ? state.slot
      : {
          start: localInput(new Date(state.booking.start_at)),
          end: localInput(new Date(state.booking.end_at)),
        }
  const [title, setTitle] = useState(booking?.title ?? '')
  const [organiser, setOrganiser] = useState(booking?.organiser ?? '')
  const [room, setRoom] = useState(
    String(
      booking?.room_id ?? (state.type === 'create' ? (state.roomId ?? '') : ''),
    ),
  )
  const [slot, setSlot] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const heading = {
    create: 'New reservation',
    edit: 'Edit reservation',
    cancel: 'Cancel reservation?',
    details: 'Reservation details',
  }[state.type]
  const roomName = rooms.find((r) => r.id === booking?.room_id)?.name
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    let path: string, method: string, body: Partial<BookingInput> | undefined
    if (state.type === 'cancel') {
      path = 'bookings/' + state.booking.id + '/cancel'
      method = 'POST'
    } else {
      if (
        !title.trim() ||
        !organiser.trim() ||
        !room ||
        !slot.start ||
        !slot.end
      ) {
        setError(
          'Meeting title, organiser, room, start time and end time are required.',
        )
        return
      }
      const start =
        booking && initial.start === slot.start
          ? new Date(booking.start_at)
          : localInstant(slot.start)
      const end =
        booking && initial.end === slot.end
          ? new Date(booking.end_at)
          : localInstant(slot.end)
      if (!start || !end) {
        setError(
          'Choose valid local times. Some times do not exist during a daylight-saving change.',
        )
        return
      }
      const duration = end.getTime() - start.getTime()
      if (duration <= 0) {
        setError('End time must be later than start time.')
        return
      }
      if (duration < 900000 || duration > 14400000) {
        setError('Reserve between 15 minutes and 4 hours.')
        return
      }
      const rescheduled =
        !booking ||
        Number(room) !== booking.room_id ||
        +start !== Date.parse(booking.start_at) ||
        +end !== Date.parse(booking.end_at)
      if (rescheduled && start.getTime() < Date.now()) {
        setError('Choose a start time in the future.')
        return
      }
      path = booking ? 'bookings/' + booking.id : 'bookings'
      method = booking ? 'PATCH' : 'POST'
      body = {
        title: title.trim(),
        organiser: organiser.trim(),
        room_id: Number(room),
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      }
      if (booking) {
        if (body.title === booking.title) delete body.title
        if (body.organiser === booking.organiser) delete body.organiser
        if (body.room_id === booking.room_id) delete body.room_id
        if (+start === Date.parse(booking.start_at)) delete body.start_at
        if (+end === Date.parse(booking.end_at)) delete body.end_at
        if (!Object.keys(body).length) {
          close()
          return
        }
      }
    }
    setBusy(true)
    try {
      const result = await request<Booking>(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      })
      saved(
        result,
        state.type === 'cancel'
          ? 'Reservation cancelled.'
          : booking
            ? 'Reservation updated.'
            : 'Reservation created.',
      )
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ', ' +
    clock(value)
  return (
    <Modal title={heading} close={close} busy={busy}>
      {booking && state.type === 'details' ? (
        <>
          <h3 className="meeting-title">{booking.title}</h3>
          <dl>
            {[
              ['Room', roomName],
              ['Organiser', booking.organiser],
              ['Starts', fmt(booking.start_at)],
              ['Ends', fmt(booking.end_at)],
              ['Timezone', timezone],
              ['Status', booking.status === 'active' ? 'Active' : 'Cancelled'],
            ].map(([label, value]) => (
              <div key={label} className="detail-row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {booking.status === 'active' && (
            <div className="dialog-actions">
              <button
                className="btn"
                onClick={() => change({ type: 'cancel', booking })}
              >
                Cancel reservation
              </button>
              <button
                className="btn primary"
                onClick={() => change({ type: 'edit', booking })}
              >
                Edit reservation
              </button>
            </div>
          )}
        </>
      ) : (
        <form noValidate onSubmit={submit}>
          {state.type === 'cancel' ? (
            <p className="subtle">
              Cancel <strong>{booking!.title}</strong> in {roomName}? The room
              will become available for this time.
            </p>
          ) : (
            <div className="form-grid">
              <label className="field">
                Meeting title
                <input
                  autoFocus
                  required
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="field">
                Organiser
                <input
                  required
                  maxLength={100}
                  value={organiser}
                  onChange={(e) => setOrganiser(e.target.value)}
                />
              </label>
              <label className="field">
                Room
                <select
                  aria-label="Room"
                  required
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                >
                  <option value="">Choose a room</option>
                  {rooms.map((r) => (
                    <option value={r.id} key={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Start time
                <input
                  required
                  type="datetime-local"
                  value={slot.start}
                  onChange={(e) => setSlot({ ...slot, start: e.target.value })}
                />
              </label>
              <label className="field">
                End time
                <input
                  required
                  type="datetime-local"
                  value={slot.end}
                  onChange={(e) => setSlot({ ...slot, end: e.target.value })}
                />
              </label>
              <p className="timezone-note">
                <Clock3 size={14} />
                {timezone} · 15 minutes to 4 hours
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="notice error mt-3">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="btn"
              onClick={close}
              disabled={busy}
            >
              {state.type === 'cancel' ? 'Keep reservation' : 'Close'}
            </button>
            <button
              type="submit"
              className={
                'btn ' + (state.type === 'cancel' ? 'danger' : 'primary')
              }
              disabled={busy}
            >
              {busy
                ? 'Saving…'
                : state.type === 'cancel'
                  ? 'Confirm cancellation'
                  : booking
                    ? 'Save changes'
                    : 'Create reservation'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
