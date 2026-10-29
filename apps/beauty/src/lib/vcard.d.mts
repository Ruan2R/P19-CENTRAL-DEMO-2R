export type ImportedVCardContact = {
  name: string
  phone: string
}

export type ParsedVCardContacts = {
  contacts: ImportedVCardContact[]
  ignored: number
}

export function parseVCardContacts(source: string): ParsedVCardContacts
