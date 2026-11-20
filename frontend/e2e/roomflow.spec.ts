import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test'

const API = 'http://127.0.0.1:8781/api'

function dateKeyAfter(days: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + days * 86_400_000))
}

const TARGET_DATE = dateKeyAfter(45)
const START = `${TARGET_DATE}T09:00`
const END = `${TARGET_DATE}T10:00`

async function cancelE2EBookings(request: APIRequestContext) {
  const response = await request.get(`${API}/bookings`)
  if (!response.ok()) return
  const bookings = (await response.json()) as Array<{
    id: number
    title: string
    status: string
  }>
  for (const booking of bookings) {
    if (booking.title.startsWith('E2E ') && booking.status === 'active') {
      await request.post(`${API}/bookings/${booking.id}/cancel`)
    }
  }
}

async function openNewReservation(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /^New reservation$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'New reservation' })).toBeVisible()
  return dialog
}

async function selectAtlas(dialog: Locator) {
  const select = dialog.getByRole('combobox', { name: 'Room' })
  const option = select.locator('option').filter({ hasText: 'Atlas Boardroom' })
  const value = await option.getAttribute('value')
  if (!value) throw new Error('Atlas Boardroom option was not found.')
  await select.selectOption(value)
}

async function fillReservation(dialog: Locator, title: string) {
  await dialog.getByLabel('Meeting title').fill(title)
  await dialog.getByLabel('Organiser').fill('Playwright')
  await selectAtlas(dialog)
  await dialog.getByLabel('Start time').fill(START)
  await dialog.getByLabel('End time').fill(END)
}

async function createReservation(page: Page, title: string) {
  const dialog = await openNewReservation(page)
  await fillReservation(dialog, title)
  await dialog.getByRole('button', { name: 'Create reservation' }).click()
  await expect(page.getByText('Reservation created.')).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()
}

async function openDetails(page: Page, title: string) {
  await page.getByRole('button', { name: new RegExp(title) }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Reservation details' })).toBeVisible()
  return dialog
}

test.beforeEach(async ({ request }) => {
  await cancelE2EBookings(request)
})

test.afterEach(async ({ request }) => {
  await cancelE2EBookings(request)
})

test('creates a reservation and rejects a conflicting one', async ({ page }) => {
  await page.goto('/#reservations')
  await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible()

  await createReservation(page, 'E2E planning')
  await openDetails(page, 'E2E planning')
  await page.getByRole('button', { name: 'Close dialog' }).click()

  const conflict = await openNewReservation(page)
  await fillReservation(conflict, 'E2E conflict')
  await conflict.getByRole('button', { name: 'Create reservation' }).click()
  await expect(conflict.getByRole('alert')).toContainText('already booked')
  await conflict.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('button', { name: /E2E planning/ })).toBeVisible()
})

test('edits and cancels a reservation', async ({ page }) => {
  await page.goto('/#reservations')
  await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible()
  await createReservation(page, 'E2E edit me')

  const details = await openDetails(page, 'E2E edit me')
  await details.getByRole('button', { name: 'Edit reservation' }).click()

  const edit = page.getByRole('dialog')
  await expect(edit.getByRole('heading', { name: 'Edit reservation' })).toBeVisible()
  await edit.getByLabel('Meeting title').fill('E2E updated')
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Reservation updated.')).toBeVisible()

  const updated = await openDetails(page, 'E2E updated')
  await updated.getByRole('button', { name: 'Cancel reservation' }).click()

  const confirm = page.getByRole('dialog')
  await expect(confirm.getByRole('heading', { name: 'Cancel reservation?' })).toBeVisible()
  await confirm.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(page.getByText('Reservation cancelled.')).toBeVisible()

  await page.getByLabel('Show cancelled').check()
  const cancelled = await openDetails(page, 'E2E updated')
  await expect(cancelled.getByText('Cancelled', { exact: true })).toBeVisible()
})
