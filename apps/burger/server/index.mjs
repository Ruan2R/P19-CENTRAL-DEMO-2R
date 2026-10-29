import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createJsonStore } from './json-store.mjs'
import { createApiServer } from './api.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (process.env.NODE_ENV === 'production') {
  console.error('P16 Etapa 05 usa API local de desenvolvimento e não pode iniciar em produção.')
  process.exit(1)
}
const host = process.env.P16_API_HOST || '127.0.0.1'
const port = Number(process.env.P16_API_PORT || 3016)
if (host !== '127.0.0.1' && host !== 'localhost') {
  throw new Error('A API desta etapa deve ficar vinculada somente a localhost (127.0.0.1).')
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('P16_API_PORT inválida.')

const store = await createJsonStore({ rootDir: root })
const server = createApiServer({ store })
server.headersTimeout = 10_000
server.requestTimeout = 20_000
server.keepAliveTimeout = 5_000
server.listen(port, host, () => {
  console.log('\nP16 — ADEGA DO COPÃO | API local de desenvolvimento')
  console.log(`API: http://${host}:${port}`)
  console.log(`Persistência: ${store.filePath}`)
  console.log('AVISO: sem autenticação real nesta etapa; uso somente local. Não publique nem use dados reais.')
})

async function shutdown() {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
