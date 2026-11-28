import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { LogOut, Pencil, Plus, Shield, Trash2 } from 'lucide-react'
import { request } from './domain'
import type { Room } from './domain'

interface AdminAuth {
  configured: boolean
  authenticated: boolean
}

interface RoomDraft {
  name: string
  capacity: string
  location: string
  facilities: string
}

const emptyDraft: RoomDraft = {
  name: '',
  capacity: '6',
  location: '',
  facilities: '',
}

function parseFacilities(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toDraft(room: Room): RoomDraft {
  return {
    name: room.name,
    capacity: String(room.capacity),
    location: room.location,
    facilities: room.facilities.join(', '),
  }
}

export function AdminPanel({
  rooms,
  onChanged,
}: {
  rooms: Room[]
  onChanged: (message: string) => void
}) {
  const [auth, setAuth] = useState<AdminAuth | null>(null)
  const [password, setPassword] = useState('')
  const [draft, setDraft] = useState<RoomDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<RoomDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    request<AdminAuth>('admin/me')
      .then((res) => {
        if (active) setAuth(res)
      })
      .catch((err) => {
        if (active) setError((err as Error).message)
      })
    return () => {
      active = false
    }
  }, [])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await request('admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setPassword('')
      setAuth({ configured: true, authenticated: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await request('admin/logout', { method: 'POST' })
      setEditingId(null)
      setAuth({ configured: true, authenticated: false })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const created = await request<Room>('rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name,
          capacity: Number.parseInt(draft.capacity, 10),
          location: draft.location,
          facilities: parseFacilities(draft.facilities),
        }),
      })
      setDraft(emptyDraft)
      onChanged(`Added room "${created.name}".`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveRoom(event: FormEvent, roomId: number) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const updated = await request<Room>(`rooms/${roomId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editDraft.name,
          capacity: Number.parseInt(editDraft.capacity, 10),
          location: editDraft.location,
          facilities: parseFacilities(editDraft.facilities),
        }),
      })
      setEditingId(null)
      onChanged(`Updated room "${updated.name}".`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeRoom(room: Room) {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await request<void>(`rooms/${room.id}`, { method: 'DELETE' })
      if (editingId === room.id) setEditingId(null)
      onChanged(`Deleted room "${room.name}".`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!auth && !error) {
    return (
      <p className="loading" role="status">
        Checking admin session…
      </p>
    )
  }

  if (auth && !auth.configured) {
    return (
      <div className="panel">
        <p className="subtle">
          Admin mode is disabled. Set <code>ROOMFLOW_ADMIN_PASSWORD</code> on
          the server to manage rooms.
        </p>
      </div>
    )
  }

  if (!auth?.authenticated) {
    return (
      <section className="panel max-w-md">
        <h2 className="section-heading flex items-center gap-2">
          <Shield size={18} aria-hidden="true" />
          Admin sign-in
        </h2>
        <p className="subtle mb-4">
          Enter the admin password to add, edit, or delete rooms.
        </p>
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        <form className="form-grid" onSubmit={signIn}>
          <label className="field">
            Admin password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="flex justify-end">
            <button className="btn primary" type="submit" disabled={busy}>
              Sign in
            </button>
          </div>
        </form>
      </section>
    )
  }

  return (
    <div className="grid gap-5">
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2>Add room</h2>
            <p className="subtle">Create a new bookable workspace room.</p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={signOut}
            disabled={busy}
          >
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </button>
        </div>
        <form
          className="grid gap-3 md:grid-cols-4 items-end"
          onSubmit={createRoom}
        >
          <label className="field">
            Name
            <input
              type="text"
              required
              maxLength={100}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="field">
            Capacity
            <input
              type="number"
              required
              min={1}
              max={500}
              value={draft.capacity}
              onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
            />
          </label>
          <label className="field">
            Location
            <input
              type="text"
              required
              maxLength={100}
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            />
          </label>
          <label className="field">
            Facilities (comma-separated)
            <input
              type="text"
              placeholder="Display, Whiteboard"
              value={draft.facilities}
              onChange={(e) =>
                setDraft({ ...draft, facilities: e.target.value })
              }
            />
          </label>
          <div className="md:col-span-4 flex justify-end">
            <button className="btn primary" type="submit" disabled={busy}>
              <Plus size={16} aria-hidden="true" />
              Add room
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="section-heading">Existing rooms ({rooms.length})</h2>
        {rooms.length === 0 ? (
          <p className="empty">No rooms yet.</p>
        ) : (
          <div className="grid gap-3">
            {rooms.map((room) =>
              editingId === room.id ? (
                <form
                  key={room.id}
                  className="grid gap-3 md:grid-cols-4 items-end border border-[var(--line)] rounded-lg p-3"
                  onSubmit={(e) => saveRoom(e, room.id)}
                >
                  <label className="field">
                    Name
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={editDraft.name}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, name: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    Capacity
                    <input
                      type="number"
                      required
                      min={1}
                      max={500}
                      value={editDraft.capacity}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, capacity: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    Location
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={editDraft.location}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, location: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    Facilities
                    <input
                      type="text"
                      value={editDraft.facilities}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          facilities: e.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="md:col-span-4 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn primary"
                      disabled={busy}
                    >
                      Save changes
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  key={room.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] rounded-lg p-3"
                >
                  <div className="grid gap-1">
                    <strong>{room.name}</strong>
                    <span className="subtle">
                      {room.capacity} seats · {room.location}
                    </span>
                    {room.facilities.length > 0 && (
                      <div className="tags">
                        {room.facilities.map((item) => (
                          <span key={item} className="tag">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(room.id)
                        setEditDraft(toDraft(room))
                        setError('')
                      }}
                    >
                      <Pencil size={14} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      disabled={busy}
                      onClick={() => removeRoom(room)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  )
}
