import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createStorage } from '../server/storage.mjs'

test('bulk contact import normalizes Brazilian phones, preserves contacts without phones and skips duplicates', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p18-contact-import-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development' }, tempRoot)
    const contacts = [
      { name: 'Ruan Rodrigues', phone: '+55 (67) 99999-1234' },
      { name: 'Ruan Rodrigues duplicado', phone: '67999991234' },
      { name: 'Ana Souza', phone: '' },
      { name: 'ana souza', phone: '' },
      { name: 'Contato com número inválido', phone: '123' },
      { name: '🤍', phone: '67999990099' },
    ]

    const first = await store.importCustomers(contacts)
    assert.deepEqual(first, { created: 2, duplicates: 2, invalid: 2 })

    let data = await store.getAdminData()
    assert.equal(data.customers.length, 2)
    const ruan = data.customers.find((customer) => customer.phone === '67999991234')
    const ana = data.customers.find((customer) => customer.name === 'Ana Souza')
    assert.ok(ruan)
    assert.ok(ana)
    assert.equal(ana.phone, '')

    const repeated = await store.importCustomers(contacts)
    assert.deepEqual(repeated, { created: 0, duplicates: 4, invalid: 2 })
    data = await store.getAdminData()
    assert.equal(data.customers.length, 2, 'reimporting the same file must not create extra profiles')

    const reloadedStore = await createStorage({ NODE_ENV: 'development' }, tempRoot)
    const reloaded = await reloadedStore.getAdminData()
    assert.equal(reloaded.customers.length, 2, 'imported profiles must persist in local JSON storage')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('bulk contact import rejects an oversized or missing contact list', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'p17-contact-import-invalid-test-'))
  try {
    const store = await createStorage({ NODE_ENV: 'development' }, tempRoot)
    await assert.rejects(store.importCustomers([]), /INVALID_CONTACT_IMPORT/)
    await assert.rejects(store.importCustomers(Array.from({ length: 5001 }, () => ({ name: 'Ana Souza', phone: '' }))), /INVALID_CONTACT_IMPORT/)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})
