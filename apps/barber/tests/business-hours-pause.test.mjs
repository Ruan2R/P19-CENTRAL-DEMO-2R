import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createStorage } from '../server/storage.mjs'
import { handleAdminRoute } from '../server/routes/admin.mjs'

test('admin can remove a weekly pause by clearing both pause times together', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'p15-hours-pause-'))
  const storage = await createStorage({ NODE_ENV: 'development', P15_LOCAL_DB_PATH: path.join(directory, 'local-db.json') }, directory)
  t.after(async () => { await storage.close?.(); await rm(directory, { recursive: true, force: true }) })

  await storage.updateBusinessHours(2, {
    enabled: true, openTime: '09:00', closeTime: '20:00', breakStart: '13:00', breakEnd: '14:00',
  })
  const result = await handleAdminRoute({
    method: 'PUT', pathname: '/api/admin/business-hours/2', searchParams: new URLSearchParams(), storage,
    session: { id: 'ADMIN', displayName: 'Administrador', role: 'owner' },
    readBody: async () => ({ weekday: 2, enabled: true, openTime: '09:00', closeTime: '20:00', breakStart: null, breakEnd: null }),
  })

  assert.equal(result.status, 200)
  const tuesday = (await storage.getAdminConfiguration()).businessHours.find((day) => day.weekday === 2)
  assert.equal(tuesday.breakStart, null)
  assert.equal(tuesday.breakEnd, null)
  assert.equal(tuesday.openTime, '09:00')
  assert.equal(tuesday.closeTime, '20:00')
})
