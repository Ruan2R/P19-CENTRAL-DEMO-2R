import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAvailableSlots, minutesToTime, timeToMinutes } from '../server/domain/availability.mjs'

test('uses a 30-minute start grid anchored to opening time', () => {
  assert.deepEqual(buildAvailableSlots({ openTime: '13:00', closeTime: '15:00', durationMinutes: 30 }), [
    '13:00', '13:30', '14:00', '14:30',
  ])
})

test('a 45-minute appointment at 13:00 makes 13:30 unavailable and 14:00 the next start', () => {
  const slots = buildAvailableSlots({
    openTime: '13:00', closeTime: '15:00', durationMinutes: 30,
    busyIntervals: [{ startTime: '13:00', durationMinutes: 45 }],
  })
  assert.deepEqual(slots, ['14:00', '14:30'])
})

test('does not round the real service duration to the grid', () => {
  const slots = buildAvailableSlots({
    openTime: '13:00', closeTime: '15:00', durationMinutes: 45,
    busyIntervals: [{ startTime: '14:00', durationMinutes: 30 }],
  })
  assert.deepEqual(slots, ['13:00'])
})

test('rejects slots that would extend past closing time', () => {
  assert.deepEqual(buildAvailableSlots({ openTime: '13:00', closeTime: '14:00', durationMinutes: 45 }), ['13:00'])
})

test('rejects any overlap with a professional block', () => {
  const slots = buildAvailableSlots({
    openTime: '09:00', closeTime: '11:00', durationMinutes: 30,
    blockedIntervals: [{ startTime: '09:45', durationMinutes: 30 }],
  })
  assert.deepEqual(slots, ['09:00', '10:30'])
})

test('does not offer past starts on the current business day', () => {
  const slots = buildAvailableSlots({ openTime: '09:00', closeTime: '11:00', durationMinutes: 15, isToday: true, nowMinutes: timeToMinutes('09:30') })
  assert.deepEqual(slots, ['10:00', '10:30'])
})

test('time helper functions validate input', () => {
  assert.equal(timeToMinutes('13:30'), 810)
  assert.equal(minutesToTime(810), '13:30')
  assert.throws(() => timeToMinutes('25:00'), /INVALID_TIME/)
})
