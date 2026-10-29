import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { hashPassword, validateLoginId } from './auth.mjs'

async function promptSecret(label) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Execute este comando em um terminal interativo do VS Code para digitar a senha com segurança.')
  }
  stdout.write(label)
  stdin.setRawMode(true)
  stdin.resume()
  return new Promise((resolve, reject) => {
    let value = ''
    const onData = (buffer) => {
      for (const character of buffer.toString('utf8')) {
        if (character === '\u0003') {
          cleanup()
          reject(new Error('Configuração cancelada.'))
          return
        }
        if (character === '\r' || character === '\n') {
          cleanup()
          stdout.write('\n')
          resolve(value)
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
          continue
        }
        if (character >= ' ') value += character
      }
    }
    function cleanup() {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
    }
    stdin.on('data', onData)
  })
}

async function readEnvLines(envPath) {
  try { return (await readFile(envPath, 'utf8')).split(/\r?\n/) } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

function hasExistingAdminConfig(lines) {
  return lines.some((line) => /^\s*(ADMIN_USERS_JSON|ADMIN_LOGIN_ID|ADMIN_PASSWORD_HASH)\s*=/.test(line))
}

async function main() {
  const envPath = path.resolve('.env.local')
  let lines = await readEnvLines(envPath)
  const rl = createInterface({ input: stdin, output: stdout })

  if (hasExistingAdminConfig(lines)) {
    const answer = (await rl.question('Já existem credenciais administrativas. Este processo vai substituir os acessos configurados e encerrar sessões existentes. Continuar? [s/N]: ')).trim().toLowerCase()
    if (!['s', 'sim'].includes(answer)) {
      rl.close()
      console.log('Nenhuma credencial foi alterada.')
      return
    }
  }

  const ownerId = validateLoginId((await rl.question('ID do proprietário [RUAN-2R]: ')).trim() || 'RUAN-2R')
  const anaId = validateLoginId((await rl.question('ID da Ana [ANA-001]: ')).trim() || 'ANA-001')
  rl.close()

  if (ownerId === anaId) throw new Error('Os dois usuários precisam ter IDs diferentes.')

  console.log('\nVamos criar senhas separadas para cada pessoa. A digitação ficará oculta.\n')
  const ownerPassword = await promptSecret('Senha do proprietário (mínimo 12 caracteres): ')
  if (ownerPassword.length < 12) throw new Error('A senha do proprietário precisa ter pelo menos 12 caracteres.')
  const ownerConfirmation = await promptSecret('Confirme a senha do proprietário: ')
  if (ownerPassword !== ownerConfirmation) throw new Error('As senhas do proprietário não coincidem.')

  const anaPassword = await promptSecret('Senha da Ana (mínimo 12 caracteres): ')
  if (anaPassword.length < 12) throw new Error('A senha da Ana precisa ter pelo menos 12 caracteres.')
  const anaPasswordConfirmation = await promptSecret('Confirme a senha da Ana: ')
  if (anaPassword !== anaPasswordConfirmation) throw new Error('As senhas da Ana não coincidem.')
  if (ownerPassword === anaPassword) throw new Error('Use senhas diferentes para cada pessoa.')

  const users = [
    { id: ownerId, displayName: 'Ruan Rodrigues', role: 'owner', passwordHash: hashPassword(ownerPassword) },
    { id: anaId, displayName: 'Ana Amaral', role: 'studio_admin', passwordHash: hashPassword(anaPassword) },
  ]
  const authSecret = randomBytes(48).toString('base64url')
  const managedKeys = new Set(['ADMIN_USERS_JSON', 'ADMIN_LOGIN_ID', 'ADMIN_PASSWORD_HASH', 'AUTH_SECRET'])
  lines = lines.filter((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/)
    if (!match) return true
    if (managedKeys.has(match[1])) return false
    if (match[1].startsWith('VITE_SUPABASE_') || ['VITE_ADMIN_LOGIN_ID', 'VITE_ADMIN_AUTH_IDENTITY'].includes(match[1])) return false
    return true
  })
  while (lines.length && !lines.at(-1).trim()) lines.pop()
  lines.push(
    '',
    '# Credenciais P18 — contas individuais; não publique este arquivo no Git.',
    `ADMIN_USERS_JSON=${JSON.stringify(users)}`,
    `AUTH_SECRET=${authSecret}`,
  )
  if (!lines.some((line) => line.startsWith('VITE_TURNSTILE_SITE_KEY='))) lines.push('VITE_TURNSTILE_SITE_KEY=')
  await writeFile(envPath, `${lines.join('\n')}\n`, { mode: 0o600 })

  console.log('\nAcessos administrativos configurados em .env.local.')
  console.log(`Proprietário: ${ownerId} (Ruan Rodrigues)`)
  console.log(`Administradora do sistema: ${anaId} (Ana Amaral)`)
  console.log('As senhas foram armazenadas somente como hashes scrypt. Nenhum e-mail foi solicitado.')
  console.log('As duas contas têm acesso às funções operacionais atuais do painel; o perfil de proprietário identifica sua conta para recursos administrativos futuros.')
  console.log('Reinicie o servidor com npm run dev para aplicar a configuração.')
}

main().catch((error) => {
  console.error(`\nNão foi possível configurar os acessos: ${error.message}`)
  process.exit(1)
})
