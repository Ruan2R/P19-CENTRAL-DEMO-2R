import test from 'node:test'
import assert from 'node:assert/strict'
import { formatBrazilPhone, formatBrazilPhoneInput } from '../src/lib/phone.mjs'

test('Brazilian phone input uses a consistent visual mask for mobile and landline numbers', () => {
  assert.equal(formatBrazilPhoneInput('67999999999'), '(67) 99999-9999')
  assert.equal(formatBrazilPhoneInput('(67) 99999-9999'), '(67) 99999-9999')
  assert.equal(formatBrazilPhoneInput('6733333333'), '(67) 3333-3333')
  assert.equal(formatBrazilPhoneInput('+55 (67) 99999-9999'), '(67) 99999-9999')
})

test('display formatter keeps stored digits normalized while rendering the standard format', () => {
  assert.equal(formatBrazilPhone('67999999999'), '(67) 99999-9999')
  assert.equal(formatBrazilPhone('6733333333'), '(67) 3333-3333')
})
