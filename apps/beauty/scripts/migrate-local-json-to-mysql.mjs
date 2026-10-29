import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { normalizeBrazilPhone } from '../server/domain.mjs'
import { toMysqlDate, toMysqlTime, toMysqlUtcDateTime, validateLocalDataset } from './lib/local-json-migration.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_KEYS = ['.env', '.env.local', '.env.development', '.env.development.local']
const OPERATIONAL_TABLES = ['appointments', 'customers', 'promotions', 'promotion_items', 'financial_entries', 'payables', 'date_blocks']
const DEFAULT_POLICIES = {
  lateness_tolerance_minutes: 10,
  cancellation_notice_hours: 2,
  companion_policy: 'Para manter um ambiente tranquilo, combine previamente com a Ana se precisar levar acompanhante ou crianças.',
  no_show_policy: 'Em caso de não comparecimento ou cancelamento/reagendamento fora do prazo, o sinal pago não será devolvido.',
}

function parseArgs(argv) {
  const args = { mode: null, file: path.join(root, 'data', 'local-db.json') }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (['--check-only', '--dry-run', '--apply'].includes(arg)) {
      if (args.mode) throw new Error('Escolha somente uma opção: --check-only, --dry-run ou --apply.')
      args.mode = arg.slice(2)
    } else if (arg === '--file') {
      const value = argv[index + 1]
      if (!value) throw new Error('Informe o caminho após --file.')
      args.file = path.resolve(process.cwd(), value)
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      args.mode = 'help'
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`)
    }
  }
  if (!args.mode) throw new Error('Escolha uma opção explícita: --check-only, --dry-run ou --apply.')
  return args
}

async function loadEnvironment() {
  const result = {}
  for (const name of SOURCE_KEYS) {
    let content
    try { content = await readFile(path.join(root, name), 'utf8') }
    catch (error) { if (error?.code === 'ENOENT') continue; throw error }
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!match) continue
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      result[match[1]] = value
    }
  }
  return { ...result, ...process.env }
}

function printHelp() {
  console.log(`P17 — importação única de data/local-db.json para MySQL

Primeiro uso:
  npm run db:check-local-json
  npm run db:import-local-json -- --dry-run
  npm run db:import-local-json -- --apply

O modo --check-only valida apenas o arquivo e não conecta ao MySQL.
O modo --dry-run confere se o banco-alvo está pronto, sem gravar dados.
O modo --apply importa dentro de uma transação e exige banco exclusivo/limpo.
A importação não é sincronização contínua. Não use para atualizar um banco já em produção.

Opções:
  --file <caminho>  Usa outro arquivo JSON (caminho relativo ao terminal ou absoluto).
`)
}

function reportCounts(counts, prefix = '') {
  for (const [key, value] of Object.entries(counts)) console.log(`  ${prefix}${key.padEnd(20)} ${String(value).padStart(6)}`)
}

async function readSource(filePath) {
  const rawBytes = await readFile(filePath)
  let raw
  try { raw = JSON.parse(rawBytes.toString('utf8')) }
  catch { throw new Error(`O arquivo ${filePath} não contém JSON válido.`) }
  const plan = validateLocalDataset(raw)
  const sha256 = createHash('sha256').update(rawBytes).digest('hex')
  return { ...plan, sha256, filename: path.basename(filePath) }
}

function assertDatabaseConfig(env) {
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter((key) => !String(env[key] ?? '').trim())
  if (missing.length) throw new Error(`MySQL não configurado. Defina ${missing.join(', ')} em .env.local ou no ambiente antes de usar --dry-run/--apply.`)
}

async function countRows(connection, table) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``)
  return Number(rows[0]?.row_count ?? 0)
}

async function ensureTargetReady(connection, data) {
  const existingImport = await connection.query('SELECT source_sha256, source_file, row_counts FROM p14_local_json_imports LIMIT 10')
  if (existingImport[0].length > 0) throw new Error('O banco já contém um registro de importação P14. Esta ferramenta é somente para a carga inicial; não faça uma segunda carga por cima.')

  const counts = {}
  for (const table of OPERATIONAL_TABLES) counts[table] = await countRows(connection, table)
  const occupied = Object.entries(counts).filter(([, count]) => count > 0)
  if (occupied.length) {
    throw new Error(`O banco de destino não está limpo (${occupied.map(([table, count]) => `${table}=${count}`).join(', ')}). Para evitar duplicação ou sobrescrita, a importação foi bloqueada. Use um banco exclusivo e novo para o P14.`)
  }

  const [targetServices] = await connection.query('SELECT id, slug FROM services ORDER BY slug')
  const sourceSlugs = new Set(data.services.map((service) => String(service.slug)))
  const unexpected = targetServices.filter((service) => !sourceSlugs.has(String(service.slug)))
  if (unexpected.length) throw new Error(`Há serviços no destino que não existem no JSON local (${unexpected.map((item) => item.slug).join(', ')}). Use um banco novo ou revise o catálogo antes de importar.`)

  const [busyHours] = await connection.query('SELECT COUNT(*) AS row_count FROM business_hours WHERE enabled = 1 OR start_time IS NOT NULL OR end_time IS NOT NULL OR break_start IS NOT NULL OR break_end IS NOT NULL')
  if (Number(busyHours[0]?.row_count ?? 0) > 0) throw new Error('O destino já tem horários de funcionamento configurados. A importação foi bloqueada para não sobrescrevê-los silenciosamente.')

  const [policyRows] = await connection.query('SELECT lateness_tolerance_minutes, cancellation_notice_hours, companion_policy, no_show_policy FROM business_policies WHERE singleton = 1 LIMIT 1')
  if (policyRows.length !== 1) throw new Error('A linha padrão de business_policies não existe. Execute o schema.mysql.sql atualizado em um banco exclusivo antes de importar.')
  const targetPolicy = policyRows[0]
  for (const key of Object.keys(DEFAULT_POLICIES)) {
    if (String(targetPolicy[key]) !== String(DEFAULT_POLICIES[key])) throw new Error(`A política do banco de destino (${key}) já foi alterada. A importação foi bloqueada para evitar sobrescrever uma configuração existente.`)
  }
  return { counts, targetServiceCount: targetServices.length }
}

async function syncServices(connection, services, timestampFallback) {
  const [rows] = await connection.query('SELECT id, slug FROM services')
  const bySlug = new Map(rows.map((row) => [String(row.slug), String(row.id)]))
  const byId = new Map(rows.map((row) => [String(row.id), String(row.slug)]))
  const serviceIdMap = new Map()
  for (const service of services) {
    const slug = String(service.slug)
    const existingId = bySlug.get(slug)
    const createdAt = toMysqlUtcDateTime(service.created_at, timestampFallback)
    const updatedAt = toMysqlUtcDateTime(service.updated_at, timestampFallback)
    if (existingId) {
      await connection.query(`UPDATE services SET name = ?, category = ?, description = ?, duration_minutes = ?, price_cents = ?, deposit_percent = ?, active = ?, sort_order = ?, created_at = ?, updated_at = ? WHERE id = ?`, [
        service.name, service.category, String(service.description ?? '').slice(0, 1000), Number(service.duration_minutes), Number(service.price_cents), Number(service.deposit_percent ?? 30), service.active ? 1 : 0, Number(service.sort_order ?? 0), createdAt, updatedAt, existingId,
      ])
      serviceIdMap.set(String(service.id), existingId)
    } else {
      const conflictSlug = byId.get(String(service.id))
      if (conflictSlug) throw new Error(`O ID local do serviço "${slug}" já pertence ao serviço "${conflictSlug}" no destino.`)
      await connection.query(`INSERT INTO services (id, slug, name, category, description, duration_minutes, price_cents, deposit_percent, active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        service.id, slug, service.name, service.category, String(service.description ?? '').slice(0, 1000), Number(service.duration_minutes), Number(service.price_cents), Number(service.deposit_percent ?? 30), service.active ? 1 : 0, Number(service.sort_order ?? 0), createdAt, updatedAt,
      ])
      bySlug.set(slug, String(service.id))
      byId.set(String(service.id), slug)
      serviceIdMap.set(String(service.id), String(service.id))
    }
  }
  return serviceIdMap
}

async function performImport(connection, source) {
  const { data, counts, sha256, filename } = source
  await connection.beginTransaction()
  try {
    const [priorImports] = await connection.query('SELECT id FROM p14_local_json_imports WHERE source_sha256 = ? LIMIT 1 FOR UPDATE', [sha256])
    if (priorImports.length) {
      await connection.rollback()
      console.log('Este arquivo exato já foi importado (SHA-256 igual). Nenhum dado foi alterado.')
      return
    }
    await ensureTargetReady(connection, data)

    const timestampFallback = new Date().toISOString()
    const serviceIdMap = await syncServices(connection, data.services, timestampFallback)

    for (const hour of data.business_hours) {
      await connection.query(`INSERT INTO business_hours (weekday, enabled, start_time, end_time, break_start, break_end, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), start_time = VALUES(start_time), end_time = VALUES(end_time), break_start = VALUES(break_start), break_end = VALUES(break_end), updated_at = VALUES(updated_at)`, [
        Number(hour.weekday), hour.enabled ? 1 : 0, hour.enabled ? toMysqlTime(hour.start_time) : null, hour.enabled ? toMysqlTime(hour.end_time) : null,
        hour.enabled && hour.break_start ? toMysqlTime(hour.break_start) : null, hour.enabled && hour.break_end ? toMysqlTime(hour.break_end) : null,
        toMysqlUtcDateTime(hour.updated_at, timestampFallback),
      ])
    }

    const policy = data.business_policies
    await connection.query(`INSERT INTO business_policies (singleton, lateness_tolerance_minutes, cancellation_notice_hours, companion_policy, no_show_policy, updated_at)
      VALUES (1, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE lateness_tolerance_minutes = VALUES(lateness_tolerance_minutes), cancellation_notice_hours = VALUES(cancellation_notice_hours), companion_policy = VALUES(companion_policy), no_show_policy = VALUES(no_show_policy), updated_at = VALUES(updated_at)`, [
      Number(policy.lateness_tolerance_minutes), Number(policy.cancellation_notice_hours), String(policy.companion_policy), String(policy.no_show_policy), toMysqlUtcDateTime(policy.updated_at, timestampFallback),
    ])

    for (const block of data.date_blocks) {
      await connection.query('INSERT INTO date_blocks (id, blocked_date, start_time, end_time, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        block.id, toMysqlDate(block.blocked_date, 'blocked_date'), toMysqlTime(block.start_time), toMysqlTime(block.end_time), String(block.note ?? '').slice(0, 120), toMysqlUtcDateTime(block.created_at, timestampFallback),
      ])
    }

    for (const customer of data.customers) {
      await connection.query('INSERT INTO customers (id, name, phone, require_deposit, internal_note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        customer.id, customer.name, normalizeBrazilPhone(customer.phone), customer.require_deposit ? 1 : 0, String(customer.internal_note ?? '').slice(0, 500),
        toMysqlUtcDateTime(customer.created_at, timestampFallback), toMysqlUtcDateTime(customer.updated_at, timestampFallback),
      ])
    }

    for (const promotion of data.promotions) {
      await connection.query('INSERT INTO promotions (id, name, starts_on, ends_on, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        promotion.id, promotion.name, toMysqlDate(promotion.starts_on), toMysqlDate(promotion.ends_on), promotion.active ? 1 : 0,
        toMysqlUtcDateTime(promotion.created_at, timestampFallback), toMysqlUtcDateTime(promotion.updated_at, timestampFallback),
      ])
      for (const item of promotion.items) {
        const mappedServiceId = serviceIdMap.get(String(item.service_id))
        if (!mappedServiceId) throw new Error(`Não foi possível mapear o serviço ${item.service_id} da promoção ${promotion.name}.`)
        await connection.query('INSERT INTO promotion_items (promotion_id, service_id, promotional_price_cents) VALUES (?, ?, ?)', [promotion.id, mappedServiceId, Number(item.promotional_price_cents)])
      }
    }

    for (const appointment of data.appointments) {
      const mappedServiceId = serviceIdMap.get(String(appointment.service_id))
      if (!mappedServiceId) throw new Error(`Não foi possível mapear o serviço do agendamento ${appointment.public_code}.`)
      await connection.query(`INSERT INTO appointments
        (id, public_code, customer_name, customer_phone, customer_note, service_id, promotion_id, promotion_name, starts_at, ends_at, price_cents, regular_price_cents, deposit_cents, deposit_required, deposit_received, deposit_reported, policy_acknowledged, policy_acknowledged_at, policy_snapshot, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        appointment.id, String(appointment.public_code).toUpperCase(), appointment.customer_name, normalizeBrazilPhone(appointment.customer_phone), appointment.customer_note ?? null,
        mappedServiceId, appointment.promotion_id ?? null, appointment.promotion_name ?? null,
        toMysqlUtcDateTime(appointment.starts_at), toMysqlUtcDateTime(appointment.ends_at), Number(appointment.price_cents), Number(appointment.regular_price_cents ?? appointment.price_cents),
        Number(appointment.deposit_cents ?? 0), appointment.deposit_required ? 1 : 0, appointment.deposit_received ? 1 : 0, appointment.deposit_reported ? 1 : 0,
        appointment.policy_acknowledged ? 1 : 0, toMysqlUtcDateTime(appointment.policy_acknowledged_at), appointment.policy_snapshot == null ? null : JSON.stringify(appointment.policy_snapshot),
        appointment.status, toMysqlUtcDateTime(appointment.created_at, timestampFallback), toMysqlUtcDateTime(appointment.updated_at, timestampFallback),
      ])
    }

    for (const entry of data.financial_entries) {
      await connection.query(`INSERT INTO financial_entries
        (id, direction, description, category, amount_cents, movement_date, payment_method, source_type, source_id, related_appointment_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        entry.id, entry.direction, String(entry.description).slice(0, 120), String(entry.category ?? 'Geral').slice(0, 80), Number(entry.amount_cents), toMysqlDate(entry.movement_date, 'movement_date'),
        String(entry.payment_method ?? 'Não informado').slice(0, 60), entry.source_type ?? 'manual', entry.source_id ?? null, entry.related_appointment_id ?? null,
        toMysqlUtcDateTime(entry.created_at, timestampFallback),
      ])
    }

    for (const payable of data.payables) {
      await connection.query(`INSERT INTO payables (id, description, category, amount_cents, due_date, status, paid_at, expense_entry_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        payable.id, String(payable.description).slice(0, 120), String(payable.category ?? 'Geral').slice(0, 80), Number(payable.amount_cents), toMysqlDate(payable.due_date, 'due_date'),
        payable.status ?? 'pending', toMysqlUtcDateTime(payable.paid_at), payable.expense_entry_id ?? null, toMysqlUtcDateTime(payable.created_at, timestampFallback),
      ])
    }

    await connection.query('INSERT INTO p14_local_json_imports (source_sha256, source_file, row_counts, imported_at) VALUES (?, ?, ?, UTC_TIMESTAMP())', [sha256, filename, JSON.stringify(counts)])
    await connection.commit()
    console.log('\nImportação inicial concluída dentro de uma transação.')
    console.log('Nenhum arquivo JSON local foi alterado ou apagado.')
    reportCounts(counts, 'Importado: ')
  } catch (error) {
    await connection.rollback()
    throw error
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.mode === 'help') return printHelp()
  const source = await readSource(args.file)
  console.log('P17 — preparação de importação local → MySQL')
  console.log(`Arquivo: ${source.filename}`)
  console.log(`SHA-256: ${source.sha256}`)
  console.log('Registros encontrados:')
  reportCounts(source.counts)

  if (args.mode === 'check-only') {
    console.log('\nValidação do JSON concluída. Nenhuma conexão com MySQL foi aberta e nenhum arquivo foi alterado.')
    return
  }

  const env = await loadEnvironment()
  assertDatabaseConfig(env)
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    timezone: 'Z',
    dateStrings: true,
    charset: 'utf8mb4',
    enableKeepAlive: true,
  })

  try {
    await pool.query('SELECT 1')
    const connection = await pool.getConnection()
    try {
      if (args.mode === 'dry-run') {
        const state = await ensureTargetReady(connection, source.data)
        console.log('\nDRY-RUN aprovado: o arquivo e o banco parecem prontos para a carga inicial.')
        console.log(`Serviços já existentes no esquema: ${state.targetServiceCount}`)
        console.log('Nenhum dado foi gravado.')
      } else {
        console.log('\nModo APPLY: o script só prossegue porque você selecionou explicitamente --apply.')
        await performImport(connection, source)
      }
    } finally {
      connection.release()
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(`\nERRO: ${error.message}`)
  process.exitCode = 1
})
