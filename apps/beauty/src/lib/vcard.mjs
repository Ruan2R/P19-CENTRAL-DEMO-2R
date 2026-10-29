function unescapeVCard(value) {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

function decodeQuotedPrintable(value, charset = 'UTF-8') {
  if (!/^(?:UTF-8|UTF8|ISO-8859-1|WINDOWS-1252)$/i.test(charset)) return value
  const bytes = []
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '=' && /^[0-9a-f]{2}$/i.test(value.slice(index + 1, index + 3))) {
      bytes.push(parseInt(value.slice(index + 1, index + 3), 16))
      index += 2
    } else {
      bytes.push(...new TextEncoder().encode(value[index]))
    }
  }
  try {
    const normalizedCharset = /^(?:ISO-8859-1|WINDOWS-1252)$/i.test(charset) ? 'windows-1252' : 'utf-8'
    return new TextDecoder(normalizedCharset).decode(new Uint8Array(bytes))
  } catch {
    return value
  }
}

function normalizeImportedPhone(value) {
  let candidate = String(value ?? '').trim()
  candidate = candidate.replace(/^tel:/i, '')
  try { candidate = decodeURIComponent(candidate) } catch { /* Mantém o número original. */ }
  let phone = candidate.replace(/\D/g, '')
  if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) phone = phone.slice(2)
  return phone.length === 10 || phone.length === 11 ? phone : ''
}

function readProperty(line) {
  const colon = line.indexOf(':')
  if (colon < 0) return null
  const left = line.slice(0, colon)
  const rawValue = line.slice(colon + 1)
  const property = left.split(';')[0].split('.').at(-1).toUpperCase()
  const parameters = left.split(';').slice(1).join(';')
  const charset = parameters.match(/CHARSET=([^;:]+)/i)?.[1]?.replace(/^["']|["']$/g, '') ?? 'UTF-8'
  const quotedPrintable = /ENCODING=QUOTED-PRINTABLE/i.test(parameters)
  const value = unescapeVCard(quotedPrintable ? decodeQuotedPrintable(rawValue, charset) : rawValue)
  return { property, value }
}

/**
 * Parse an iPhone/Apple Contacts vCard (.vcf) file into the minimum data needed
 * by the studio directory: contact name and one valid Brazilian phone number.
 * Other personal fields are deliberately ignored.
 *
 * @param {string} source
 * @returns {{ contacts: Array<{name: string, phone: string}>, ignored: number }}
 */
export function parseVCardContacts(source) {
  const unfolded = String(source ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '')
  const cards = []
  let current = null
  for (const line of unfolded.split('\n')) {
    if (/^BEGIN:VCARD\s*$/i.test(line.trim())) {
      current = []
      continue
    }
    if (/^END:VCARD\s*$/i.test(line.trim())) {
      if (current) cards.push(current)
      current = null
      continue
    }
    if (current) current.push(line)
  }

  const contacts = []
  let ignored = 0
  for (const lines of cards) {
    let name = ''
    let fallbackName = ''
    const phones = []
    for (const line of lines) {
      const property = readProperty(line)
      if (!property) continue
      if (property.property === 'FN' && property.value) name = property.value
      if (property.property === 'N' && property.value && !fallbackName) {
        const parts = property.value.split(';').map((part) => part.trim())
        fallbackName = [parts[3], parts[1], parts[2], parts[0], parts[4]].filter(Boolean).join(' ')
      }
      if (property.property === 'TEL' && property.value) phones.push(property.value)
    }
    name = (name || fallbackName).replace(/\s+/g, ' ').trim()
    // Match MariaDB CHAR_LENGTH(name), which counts Unicode code points rather than UTF-16 code units.
    const nameLength = Array.from(name).length
    if (nameLength < 2 || nameLength > 100) {
      ignored += 1
      continue
    }
    const phone = phones.map(normalizeImportedPhone).find(Boolean) ?? ''
    if (phones.length && !phone) {
      ignored += 1
      continue
    }
    contacts.push({ name, phone })
  }
  return { contacts, ignored }
}
