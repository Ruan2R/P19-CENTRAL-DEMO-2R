export const SLOT_INTERVAL_MINUTES = 30

export function timeToMinutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) throw new Error('INVALID_TIME')
  const [hours, minutes] = String(value).split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(totalMinutes) {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0 || totalMinutes >= 24 * 60) throw new Error('INVALID_MINUTE_VALUE')
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
  const minutes = (totalMinutes % 60).toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function overlaps(startA, durationA, startB, durationB) {
  return startA < startB + durationB && startA + durationA > startB
}

function normalizeInterval(interval) {
  const start = timeToMinutes(interval.startTime)
  const duration = Number(interval.durationMinutes)
  if (!Number.isInteger(duration) || duration <= 0) throw new Error('INVALID_INTERVAL_DURATION')
  return { start, duration }
}

/**
 * Generates starts on a fixed 30-minute grid anchored to the day's opening time.
 * The service's real duration determines occupancy; it is never rounded to the grid.
 * Existing appointments and blocks that overlap any part of the requested duration remove a slot.
 * `nowMinutes` is local business time and is used only when `isToday` is true.
 */
export function buildAvailableSlots({
  openTime,
  closeTime,
  durationMinutes,
  busyIntervals = [],
  blockedIntervals = [],
  isToday = false,
  nowMinutes = null,
  intervalMinutes = SLOT_INTERVAL_MINUTES,
}) {
  const open = timeToMinutes(openTime)
  const close = timeToMinutes(closeTime)
  if (close <= open) throw new Error('INVALID_OPENING_HOURS')
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) throw new Error('INVALID_SERVICE_DURATION')
  if (!Number.isInteger(intervalMinutes) || intervalMinutes !== SLOT_INTERVAL_MINUTES) throw new Error('INVALID_SLOT_INTERVAL')
  if (isToday && (!Number.isInteger(nowMinutes) || nowMinutes < 0 || nowMinutes >= 24 * 60)) throw new Error('INVALID_CURRENT_TIME')

  const busy = busyIntervals.map(normalizeInterval)
  const blocked = blockedIntervals.map(normalizeInterval)
  const slots = []

  for (let start = open; start + durationMinutes <= close; start += SLOT_INTERVAL_MINUTES) {
    if (isToday && start <= nowMinutes) continue
    const conflictsWithBusy = busy.some((item) => overlaps(start, durationMinutes, item.start, item.duration))
    const conflictsWithBlock = blocked.some((item) => overlaps(start, durationMinutes, item.start, item.duration))
    if (!conflictsWithBusy && !conflictsWithBlock) slots.push(minutesToTime(start))
  }

  return slots
}
