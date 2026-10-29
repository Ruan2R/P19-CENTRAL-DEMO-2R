import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProductionSeed } from './lib/production-seed.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const result = {
    source: path.join(root, 'data', 'local-db.json'),
    output: path.join(root, 'data', 'production-seed.json'),
    overwrite: false,
    checkOnly: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--source' || arg === '--output') {
      const value = argv[index + 1]
      if (!value) throw new Error(`Informe um caminho depois de ${arg}.`)
      result[arg === '--source' ? 'source' : 'output'] = path.resolve(process.cwd(), value)
      index += 1
    } else if (arg === '--overwrite') result.overwrite = true
    else if (arg === '--check-only') result.checkOnly = true
    else if (arg === '--help' || arg === '-h') result.help = true
    else throw new Error(`Argumento desconhecido: ${arg}`)
  }
  return result
}

function printCounts(counts) {
  for (const [key, count] of Object.entries(counts)) console.log(`  ${key.padEnd(20)} ${String(count).padStart(5)}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(`P18 — criar uma cópia inicial limpa para produção

Uso:
  npm run db:make-production-seed
  npm run db:make-production-seed -- --check-only
  npm run db:make-production-seed -- --output data/production-seed.json --overwrite

A cópia mantém serviços, horários e políticas. Ela zera bloqueios, clientes,
promoções, agendamentos, movimentações financeiras e contas a pagar.
O arquivo original nunca é alterado. --overwrite é obrigatório para substituir um destino existente.`)
    return
  }

  const bytes = await readFile(args.source)
  let raw
  try { raw = JSON.parse(bytes.toString('utf8')) }
  catch { throw new Error(`O arquivo de origem não contém JSON válido: ${args.source}`) }

  const { data, sourceCounts, outputCounts } = createProductionSeed(raw)
  console.log('P18 — preparação de dados limpos para produção')
  console.log(`Origem: ${args.source}`)
  console.log('\nColeções na origem:')
  printCounts(sourceCounts)
  console.log('\nColeções na cópia limpa:')
  printCounts(outputCounts)
  console.log('\nServiços, horários e políticas foram preservados. Nenhum cliente, agendamento, bloqueio, promoção ou dado financeiro será levado para a produção.')

  if (args.checkOnly) {
    console.log('\nValidação concluída. Nenhum arquivo foi gravado.')
    return
  }

  try {
    await writeFile(args.output, `${JSON.stringify(data, null, 2)}\n`, { flag: args.overwrite ? 'w' : 'wx', mode: 0o600 })
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`O destino já existe: ${args.output}. Use --overwrite apenas se tiver conferido esse arquivo.`)
    throw error
  }
  console.log(`\nCópia limpa criada em: ${args.output}`)
  console.log('O arquivo de origem não foi alterado. Revise serviços, preços, horários e políticas da Ana antes de importar.')
}

main().catch((error) => {
  console.error(`\nNão foi possível criar a cópia limpa: ${error.message}`)
  process.exitCode = 1
})
