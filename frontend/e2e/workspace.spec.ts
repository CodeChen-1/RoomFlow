import { expect, test, type Page } from '@playwright/test'

function dateAfter(days: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(Date.now() + days * 86_400_000))
}

function observeBrowser(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const expectedConflict = new URL(message.location().url || 'about:blank').pathname === '/api/bookings'
      && /409/.test(message.text())
    if (!expectedConflict) errors.push(message.text())
  })
  page.on('requestfailed', request => {
    if (!request.failure()?.errorText.includes('ERR_ABORTED')) errors.push(request.url())
  })
  return errors
}

async function enterBooking(page: Page, title: string, roomId: number, start: string, end: string) {
  await page.getByRole('button', { name: /^new reservation$/i }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel(/meeting title/i).fill(title)
  await form.getByLabel(/organiser/i).fill('Rowan Lee')
  await form.getByRole('combobox', { name: 'Room', exact: true }).selectOption(String(roomId))
  await form.getByLabel(/start time/i).fill(start)
  await form.getByLabel(/end time/i).fill(end)
  await form.getByRole('button', { name: /create reservation/i }).click()
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900, days: 14 },
  { name: 'mobile', width: 390, height: 844, days: 15 },
]) {
  test(`create, reject overlap, edit, cancel and reuse a room on ${viewport.name}`, async ({ page }, info) => {
    const errors = observeBrowser(page)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const date = dateAfter(viewport.days)
    const roomsResponse = await page.request.get('/api/rooms')
    expect(roomsResponse.ok()).toBe(true)
    const [room] = await roomsResponse.json()
    const title = 'Workspace lifecycle review'
    await page.goto('/')
    await expect(page.getByRole('link', { name: /^dashboard$/i })).toBeVisible()
    await expect(page.getByText('Active reservations', { exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath(viewport.name + '-dashboard.png'), fullPage: true })
    await page.getByRole('link', { name: /^rooms$/i }).click()
    await expect(page.getByRole('heading', { name: room.name, exact: true })).toBeVisible()

    await enterBooking(page, title, room.id, date + 'T10:00', date + 'T11:00')
    await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()
    const conflictResponse = page.waitForResponse(response => response.url().endsWith('/api/bookings')
      && response.request().method() === 'POST')
    await enterBooking(page, 'Colliding review', room.id, date + 'T10:30', date + 'T11:30')
    expect((await conflictResponse).status()).toBe(409)
    await expect(page.getByRole('dialog')).toContainText(/already booked|overlap|conflict|reserved/i)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: new RegExp(title) }).click()
    await page.getByRole('button', { name: /^edit reservation$/i }).click()
    const edit = page.getByRole('dialog')
    await edit.getByLabel(/meeting title/i).fill('Rescheduled workspace review')
    await edit.getByLabel(/start time/i).fill(date + 'T12:00')
    await edit.getByLabel(/end time/i).fill(date + 'T13:00')
    await edit.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByRole('button', { name: /Rescheduled workspace review/ })).toBeVisible()

    const params = { start_at: date + 'T04:00:00Z', end_at: date + 'T05:00:00Z' }
    async function available() {
      const response = await page.request.get('/api/rooms', { params })
      expect(response.ok()).toBe(true)
      return (await response.json()).find((item: { id: number }) => item.id === room.id).available
    }
    expect(await available()).toBe(false)
    await page.getByRole('button', { name: /Rescheduled workspace review/ }).click()
    await page.getByRole('button', { name: /^cancel reservation$/i }).click()
    await page.getByRole('button', { name: /confirm cancellation/i }).click()
    await expect(page.getByRole('button', { name: /Rescheduled workspace review/ })).toHaveCount(0)
    expect(await available()).toBe(true)
    await enterBooking(page, 'Reclaimed slot', room.id, date + 'T12:00', date + 'T13:00')
    await expect(page.getByRole('button', { name: /Reclaimed slot/ })).toBeVisible()
    await page.reload()
    await page.getByLabel(/selected date/i).fill(date)
    await expect(page.getByRole('button', { name: /Reclaimed slot/ })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('dashboard clips room-hours to the selected local calendar day', async ({ page }) => {
  const day = dateAfter(20)
  const previous = dateAfter(19)
  const next = dateAfter(21)
  const response = await page.request.get('/api/rooms')
  const [roomA, roomB] = await response.json()
  async function book(roomId: number, start: string, end: string) {
    const created = await page.request.post('/api/bookings', { data: {
      room_id: roomId, title: 'Dashboard boundary', organiser: 'Kai',
      start_at: new Date(start + ':00+08:00').toISOString(), end_at: new Date(end + ':00+08:00').toISOString(),
    } })
    expect(created.status()).toBe(201)
    return (await created.json()).id
  }
  await book(roomA.id, previous + 'T23:30', day + 'T00:30')
  await book(roomA.id, day + 'T14:00', day + 'T15:00')
  await book(roomB.id, day + 'T23:45', next + 'T00:45')
  const cancelled = await book(roomB.id, day + 'T11:00', day + 'T12:00')
  expect((await page.request.post(`/api/bookings/${cancelled}/cancel`)).status()).toBe(200)
  await page.goto('/')
  await page.getByLabel(/selected date/i).fill(day)
  for (const [name, value] of [['Active reservations', '3'], ['Rooms booked', '2'], ['Reserved room-hours', '1.75']]) {
    const metric = page.locator('dl').filter({ has: page.getByText(name, { exact: true }) }).locator('dd')
    await expect(metric).toHaveText(value)
  }
})

test('primary screens and dialog fit a narrow mobile viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = observeBrowser(page)
  await page.goto('/')
  for (const name of ['Dashboard', 'Rooms', 'Reservations']) {
    await page.getByRole('link', { name, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    if (name === 'Dashboard') await expect(page.getByText('Active reservations', { exact: true })).toBeVisible()
    if (name === 'Rooms') await expect(page.locator('article').first()).toBeVisible()
    if (name === 'Reservations') await expect(page.getByLabel('Show cancelled')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await page.screenshot({ path: info.outputPath('mobile-' + name + '.png'), fullPage: true })
  }
  await page.getByRole('button', { name: /^new reservation$/i }).click()
  const form = page.getByRole('dialog')
  await expect(form.getByLabel(/meeting title/i)).toBeVisible()
  const bounds = await form.boundingBox()
  expect(bounds?.x).toBeGreaterThanOrEqual(0)
  expect((bounds?.x || 0) + (bounds?.width || 0)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: info.outputPath('mobile-form.png') })
  await page.keyboard.press('Escape')
  await expect(form).toHaveCount(0)
  expect(errors).toEqual([])
})
