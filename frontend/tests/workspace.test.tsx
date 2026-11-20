import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../src/App'

const room = {
  id: 72, name: 'Paper Garden', capacity: 9, location: 'East annex',
  facilities: ['Projector'], available: true,
}
const start = new Date(2036, 4, 12, 10, 0)
const end = new Date(start.getTime() + 3_600_000)

function localInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const saved = {
  id: 94, room_id: room.id, title: 'Field review', organiser: 'Priya',
  start_at: start.toISOString(), end_at: end.toISOString(), status: 'active',
  created_at: start.toISOString(), updated_at: start.toISOString(),
}

function mockApi(options: { existing?: boolean; conflict?: boolean } = {}) {
  let bookings = options.existing ? [{ ...saved }] : []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin)
    const method = init?.method || 'GET'
    if (method === 'GET' && url.pathname === '/api/rooms') return Response.json([room])
    if (method === 'GET' && url.pathname === '/api/bookings') {
      const since = url.searchParams.get('start_at')
      const until = url.searchParams.get('end_at')
      const status = url.searchParams.get('status')
      return Response.json(bookings.filter(b => (!since || Date.parse(b.end_at) > Date.parse(since))
        && (!until || Date.parse(b.start_at) < Date.parse(until)) && (!status || b.status === status)))
    }
    if (method === 'GET' && url.pathname === '/api/bookings/94') return Response.json(bookings[0])
    if (method === 'POST' && url.pathname === '/api/bookings') {
      if (options.conflict) return Response.json({ error: {
        code: 'conflict', message: 'Paper Garden is already booked for this time.',
      } }, { status: 409 })
      const body = JSON.parse(String(init?.body))
      const result = { ...saved, ...body }
      bookings = [...bookings, result]
      return Response.json(result, { status: 201 })
    }
    if (method === 'POST' && url.pathname === '/api/bookings/94/cancel') {
      bookings = bookings.map(b => ({ ...b, status: 'cancelled' }))
      return Response.json(bookings[0])
    }
    throw new Error(`Unexpected ${method} ${url.pathname}`)
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: /^new reservation$/i }))
  return within(await screen.findByRole('dialog'))
}

async function submitValidForm() {
  const form = await openForm()
  await form.findByRole('option', { name: /Paper Garden/ })
  fireEvent.change(form.getByLabelText(/meeting title/i), { target: { value: saved.title } })
  fireEvent.change(form.getByLabelText(/organiser/i), { target: { value: saved.organiser } })
  fireEvent.change(form.getByLabelText(/^room$/i), { target: { value: String(room.id) } })
  fireEvent.change(form.getByLabelText(/start time/i), { target: { value: localInput(start) } })
  fireEvent.change(form.getByLabelText(/end time/i), { target: { value: localInput(end) } })
  fireEvent.click(form.getByRole('button', { name: /create reservation/i }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2036, 4, 10, 8, 0))
  Object.assign(HTMLDialogElement.prototype, {
    showModal() { this.setAttribute('open', '') },
    close() { this.removeAttribute('open') },
  })
  window.history.replaceState({}, '', '/')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('RoomFlow workspace', () => {
  it('displays room names, facilities and locations from the directory API', async () => {
    mockApi()
    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: /^rooms$/i }))
    expect(await screen.findByRole('heading', { name: room.name })).toBeTruthy()
    expect(screen.getByText(room.location, { exact: false })).toBeTruthy()
    expect(screen.getAllByText('Projector').length).toBeGreaterThan(0)
  })

  it('explains missing required fields before sending a create request', async () => {
    const fetch = mockApi()
    render(<App />)
    const form = await openForm()
    fireEvent.click(form.getByRole('button', { name: /create reservation/i }))
    expect(await form.findByText(/required|enter (a |the |your |an )?(meeting title|organiser)|provide .*title/i)).toBeTruthy()
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('creates a booking with UTC instants and displays it in the schedule', async () => {
    const fetch = mockApi()
    render(<App />)
    await submitValidForm()
    expect(await screen.findByRole('button', { name: /Field review/i })).toBeTruthy()
    const create = fetch.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(create?.[1]?.body))).toMatchObject({
      title: saved.title, organiser: saved.organiser, room_id: room.id,
      start_at: start.toISOString(), end_at: end.toISOString(),
    })
  })

  it('shows the conflict and preserves the form for another time choice', async () => {
    mockApi({ conflict: true })
    render(<App />)
    await submitValidForm()
    const form = within(screen.getByRole('dialog'))
    expect(await form.findByText(/already booked/i)).toBeTruthy()
    expect((form.getByLabelText(/meeting title/i) as HTMLInputElement).value).toBe(saved.title)
  })

  it('keeps the booking until cancellation is confirmed and updates the schedule', async () => {
    const fetch = mockApi({ existing: true })
    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: /^reservations$/i }))
    fireEvent.change(await screen.findByLabelText(/selected date/i), { target: { value: localInput(start).slice(0, 10) } })
    fireEvent.click(await screen.findByRole('button', { name: /Field review/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^cancel reservation$/i }))
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
    fireEvent.click(await screen.findByRole('button', { name: /confirm cancellation/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Field review/i })).toBeNull())
    fireEvent.click(screen.getByLabelText(/show cancelled/i))
    expect(await screen.findByRole('button', { name: /Field review/i })).toBeTruthy()
    expect(screen.getAllByText(/^cancelled$/i).length).toBeGreaterThan(0)
  })
})
