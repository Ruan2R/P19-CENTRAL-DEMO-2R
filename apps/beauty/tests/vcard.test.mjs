import test from 'node:test'
import assert from 'node:assert/strict'
import { parseVCardContacts } from '../src/lib/vcard.mjs'

test('parses multiple iPhone vCards with names, Brazilian phones and contacts without a phone', () => {
  const source = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Ruan Rodrigues',
    'N:Rodrigues;Ruan;;;',
    'TEL;TYPE=CELL;TYPE=VOICE:+55 (67) 99999-1234',
    'EMAIL:ruan@example.com',
    'END:VCARD',
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Ana Souza',
    'N:Souza;Ana;;;',
    'END:VCARD',
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Maria Silva',
    'TEL;TYPE=CELL:telefone inválido',
    'END:VCARD',
  ].join('\r\n')

  const result = parseVCardContacts(source)
  assert.deepEqual(result.contacts, [
    { name: 'Ruan Rodrigues', phone: '67999991234' },
    { name: 'Ana Souza', phone: '' },
  ])
  assert.equal(result.ignored, 1)
})

test('unfolds vCard lines and unescapes contact names without importing unrelated personal fields', () => {
  const source = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Ana\\, Maria de Oliveira',
    'TEL;TYPE=CELL:67988887777',
    'NOTE:This field must not be imported',
    'END:VCARD',
  ].join('\n')
  const result = parseVCardContacts(source)
  assert.deepEqual(result.contacts, [{ name: 'Ana, Maria de Oliveira', phone: '67988887777' }])
  assert.equal(result.ignored, 0)
})

test('ignores a single-code-point emoji name that would violate the MySQL customer-name constraint', () => {
  const source = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:🤍',
    'TEL;TYPE=CELL:+55 67 99964-3984',
    'END:VCARD',
  ].join('\r\n')

  assert.deepEqual(parseVCardContacts(source), { contacts: [], ignored: 1 })
})

test('returns an empty result for text that is not a vCard file', () => {
  assert.deepEqual(parseVCardContacts('Nome,Telefone\nRuan,67999991234'), { contacts: [], ignored: 0 })
})
