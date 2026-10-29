import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [publicPage, adminPage] = await Promise.all([
  readFile(new URL('../src/pages/BookingPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/AdminPage.tsx', import.meta.url), 'utf8'),
])

test('public appointment form allows multiple service selections and shows combined totals', () => {
  assert.match(publicPage, /type="checkbox" name="booking-service"/)
  assert.match(publicPage, /serviceIds: selectedServices\.map\(\(service\) => service\.id\)/)
  assert.match(publicPage, /Duração total/)
  assert.match(publicPage, /Total estimado/)
})

test('administrative appointment form allows multiple services and sums price and duration', () => {
  assert.match(adminPage, /type="checkbox" name="admin-appointment-service"/)
  assert.match(adminPage, /const selectedTotalDuration = selectedServices\.reduce/)
  assert.match(adminPage, /const selectedTotal = selectedServices\.reduce/)
  assert.match(adminPage, /serviceIds, date, time, customerName, customerPhone, customerNote, allowMissingPhone/)
})

test('contact import, autocomplete and advanced appointment filters remain available', () => {
  assert.match(adminPage, /Importar contatos/)
  assert.match(adminPage, /admin-customer-suggestions/)
  assert.match(adminPage, /appointment-advanced-filters/)
  assert.match(adminPage, /appointmentDateFrom/)
})
