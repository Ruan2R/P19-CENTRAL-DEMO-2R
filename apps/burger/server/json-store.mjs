import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

function initialData() {
  return {
    schemaVersion: 1,
    products: [],
    stockMovements: [],
    financialEntries: [],
    payables: [],
    receivables: [],
    orders: [],
    auditLogs: [],
    demoSeedVersions: [],
    nextOrderNumber: 101,
  }
}

function isValidStoreData(data) {
  return Boolean(data && typeof data === 'object' && data.schemaVersion === 1 &&
    ['products', 'stockMovements', 'financialEntries', 'payables', 'receivables', 'orders', 'auditLogs'].every((key) => Array.isArray(data[key])) &&
    Number.isSafeInteger(data.nextOrderNumber) && data.nextOrderNumber >= 1)
}

export async function createJsonStore({ rootDir = process.cwd(), filePath = path.join(rootDir, 'data', 'local-db.json') } = {}) {
  const absoluteFile = path.resolve(filePath)
  await mkdir(path.dirname(absoluteFile), { recursive: true })
  let data
  try {
    const raw = await readFile(absoluteFile, 'utf8')
    data = JSON.parse(raw)
    if (!isValidStoreData(data)) {
      throw new Error('LOCAL_DB_SCHEMA_UNSUPPORTED: O arquivo data/local-db.json existe, mas não corresponde ao schema do P16 Etapa 05. Faça uma cópia e revise-o antes de continuar.')
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      data = initialData()
      await writeFile(absoluteFile, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' }).catch(async (writeError) => {
        if (writeError?.code !== 'EEXIST') throw writeError
        const raw = await readFile(absoluteFile, 'utf8')
        data = JSON.parse(raw)
        if (!isValidStoreData(data)) throw new Error('LOCAL_DB_SCHEMA_UNSUPPORTED')
      })
    } else {
      throw error
    }
  }

  let queue = Promise.resolve()
  let state = structuredClone(data)

  return {
    filePath: absoluteFile,
    async read() {
      await queue
      return structuredClone(state)
    },
    async transact(mutator) {
      if (typeof mutator !== 'function') throw new TypeError('mutator deve ser uma função')
      const operation = queue.then(async () => {
        const draft = structuredClone(state)
        const result = await mutator(draft)
        const tempPath = `${absoluteFile}.${randomUUID()}.tmp`
        try {
          await writeFile(tempPath, `${JSON.stringify(draft, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
          await rename(tempPath, absoluteFile)
          state = draft
          return structuredClone(result)
        } catch (error) {
          await import('node:fs/promises').then(({ rm }) => rm(tempPath, { force: true })).catch(() => {})
          throw error
        }
      })
      queue = operation.catch(() => {})
      return operation
    },
  }
}
