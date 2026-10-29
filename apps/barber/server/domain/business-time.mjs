export const BUSINESS_TIME_ZONE = 'America/Campo_Grande'

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

export function getBusinessClock(date = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

export function getBusinessDate(date = new Date()) {
  return getBusinessClock(date).date
}

export function addDateDays(value, amount) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function isValidDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export function getWeekday(value) {
  if (!isValidDate(value)) throw new Error('INVALID_DATE')
  return new Date(`${value}T12:00:00Z`).getUTCDay()
}

export function localDateTimeToUtc(date, time) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const guessedUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const parts = Object.fromEntries(formatter.formatToParts(new Date(guessedUtc)).map((part) => [part.type, part.value]))
  const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return new Date(guessedUtc - (localAsUtc - guessedUtc))
}

export function mysqlUtcDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ')
}

export function utcDateTimeToLocalParts(value) {
  const date = value instanceof Date ? value : new Date(value)
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}
