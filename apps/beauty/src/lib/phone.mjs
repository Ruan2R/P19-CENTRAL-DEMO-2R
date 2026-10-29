/** Keeps Brazilian phone numbers readable in forms while the API stores digits only. */
export function formatBrazilPhoneInput(value) {
  let phone = String(value ?? '').replace(/\D/g, '')
  if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) phone = phone.slice(2)
  phone = phone.slice(0, 11)
  if (!phone) return ''
  if (phone.length <= 2) return phone.length === 2 ? `(${phone})` : `(${phone}`

  const ddd = phone.slice(0, 2)
  const subscriber = phone.slice(2)
  if (subscriber.length <= 4) return `(${ddd}) ${subscriber}`
  if (subscriber.length <= 8) return `(${ddd}) ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`
  return `(${ddd}) ${subscriber.slice(0, 5)}-${subscriber.slice(5, 9)}`
}

/** Formats a stored normalized Brazilian number for display. */
export function formatBrazilPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return formatBrazilPhoneInput(digits)
}
