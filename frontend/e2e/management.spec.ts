import { expect, test } from '@playwright/test'

test('renaming in an older window preserves a reschedule and background refresh preserves filters', async ({ page }) => {
  const date = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10)
  const [room] = await (await page.request.get('/api/rooms')).json()
  const result = await page.request.post('/api/bookings', { data: {
    room_id: room.id, title: 'Review before rename', organiser: 'Harper',
    start_at: date + 'T02:00:00Z', end_at: date + 'T03:00:00Z',
  } })
  expect(result.status()).toBe(201)
  const endpoint = '/api/bookings/' + (await result.json()).id
  await page.goto('/#reservations')
  await page.getByLabel('Selected date').fill(date)
  await page.getByRole('button', { name: /Review before rename/ }).click()
  await page.getByRole('button', { name: 'Edit reservation' }).click()
  const moved = await page.request.patch(endpoint, { data: {
    start_at: date + 'T04:00:00Z', end_at: date + 'T05:00:00Z',
  } })
  expect(moved.ok()).toBe(true)
  await page.getByLabel('Meeting title').fill('Review after rename')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('button', { name: /Review after rename/ })).toBeVisible()
  const stored = await (await page.request.get(endpoint)).json()
  expect(Date.parse(stored.start_at)).toBe(Date.parse(date + 'T04:00:00Z'))
  expect(Date.parse(stored.end_at)).toBe(Date.parse(date + 'T05:00:00Z'))
  await page.getByLabel('Filter by room').selectOption(String(room.id))
  await page.getByLabel('Show cancelled').check()
  const refresh = page.waitForResponse(response => new URL(response.url()).pathname === '/api/bookings')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await refresh
  await expect(page.getByLabel('Filter by room')).toHaveValue(String(room.id))
  await expect(page.getByLabel('Show cancelled')).toBeChecked()
})
