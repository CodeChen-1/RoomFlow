import { expect, test } from '@playwright/test'

test.use({ timezoneId: 'America/New_York' })

test.describe('daylight saving at midnight', () => {
  test.use({ timezoneId: 'America/Santiago' })

  test('a skipped midnight does not add an hour from the next local day', async ({ page }) => {
    await page.goto('/')
    const request = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname === '/api/bookings' && url.searchParams.get('start_at') === '2024-09-08T04:00:00.000Z'
    })
    await page.getByLabel('Selected date').fill('2024-09-08')
    expect(new URL((await request).url()).searchParams.get('end_at')).toBe('2024-09-09T03:00:00.000Z')
  })
})

test('the 25-hour autumn day counts both repeated hours and clips at midnight', async ({ page }) => {
  const year = new Date().getUTCFullYear() + 2
  const firstNovember = new Date(Date.UTC(year, 10, 1))
  const sunday = 1 + (7 - firstNovember.getUTCDay()) % 7
  const midnight = Date.UTC(year, 10, sunday, 4)
  const day = new Date(midnight).toISOString().slice(0, 10)
  const rooms = await (await page.request.get('/api/rooms')).json()
  const iso = (minutes: number) => new Date(midnight + minutes * 60_000).toISOString()
  for (const [start, end] of [[-30, 30], [30, 210], [1485, 1545]]) {
    const response = await page.request.post('/api/bookings', { data: {
      room_id: rooms[0].id, title: 'Autumn time change', organiser: 'Taylor',
      start_at: iso(start), end_at: iso(end),
    } })
    expect(response.status()).toBe(201)
  }
  await page.goto('/')
  await page.getByLabel('Selected date').fill(day)
  for (const [label, value] of [
    ['Active reservations', '3'], ['Rooms booked', '1'], ['Reserved room-hours', '3.75'],
  ]) {
    const metric = page.locator('dl').filter({ has: page.getByText(label, { exact: true }) })
    await expect(metric.locator('dd')).toHaveText(value)
  }
})

test('capacity and facility filters combine against the stored room catalog', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Rooms', exact: true }).click()
  const rooms: { name: string; capacity: number; facilities: string[] }[] =
    await (await page.request.get('/api/rooms')).json()
  await page.getByLabel('Minimum capacity').fill('12')
  await page.getByRole('combobox', { name: /^Facility/ }).selectOption({ label: 'Projector' })
  const matching = rooms.filter(room => room.capacity >= 12 && room.facilities.includes('Projector'))
  expect(matching.length).toBeGreaterThan(0)
  expect(matching.length).toBeLessThan(rooms.length)
  await expect(page.locator('article').getByRole('heading')).toHaveCount(matching.length)
  for (const room of matching) {
    await expect(page.getByRole('heading', { name: room.name, exact: true })).toBeVisible()
  }
})

test('a directory room action carries the selected local interval into the form', async ({ page }) => {
  const year = new Date().getUTCFullYear() + 2
  const local = year + '-06-15T'
  const [room] = await (await page.request.get('/api/rooms')).json()
  await page.goto('/#rooms')
  await page.getByLabel('Available from').fill(local + '10:00')
  await page.getByLabel('Available until').fill(local + '11:00')
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: room.name, exact: true }) })
  await card.getByRole('button', { name: 'Book ' + room.name }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('combobox', { name: /^Room/ })).toHaveValue(String(room.id))
  await expect(dialog.getByLabel('Start time')).toHaveValue(local + '10:00')
  await expect(dialog.getByLabel('End time')).toHaveValue(local + '11:00')
  await dialog.getByLabel('Meeting title').fill('Directory handover')
  await dialog.getByLabel('Organiser').fill('Devon')
  await dialog.getByRole('button', { name: 'Create reservation' }).click()
  await expect(page.getByRole('button', { name: /Directory handover/ })).toBeVisible()
  await page.getByRole('link', { name: 'Rooms', exact: true }).click()
  await page.getByLabel('Available from').fill(local + '10:00')
  await page.getByLabel('Available until').fill(local + '11:00')
  await expect(card.getByText('Reserved', { exact: true })).toBeVisible()
  await expect(card.getByRole('button')).toBeDisabled()
})
