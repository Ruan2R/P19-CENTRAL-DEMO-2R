import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const isWindows = process.platform === 'win32';
const apps = {
  barber: path.join(root, 'apps', 'barber'),
  beauty: path.join(root, 'apps', 'beauty'),
  burger: path.join(root, 'apps', 'burger'),
};
const envBase = {
  ...process.env,
  NODE_ENV: 'development',
  P19_DEMO_MODE: 'true',
  DB_HOST: '', DB_PORT: '', DB_USER: '', DB_PASSWORD: '', DB_NAME: '', DB_CONNECTION_LIMIT: '',
  TURNSTILE_SECRET_KEY: '',
  ADMIN_USERS_JSON: '', ADMIN_LOGIN_ID: '', ADMIN_PASSWORD_HASH: '', ADMIN_PASSWORD: '', ADMIN_AUTH_SECRET: '',
  AUTH_SECRET: 'p19-local-demo-secret-not-for-production-2026',
};
const children = [];
let shuttingDown = false;

// Only .cmd launchers need a shell on Windows. Running node.exe through cmd.exe
// breaks when the Node installation path contains spaces (for example, Program Files).
function needsShell(command) {
  return isWindows && /\.cmd$/i.test(command);
}

function runSync(command, args, cwd, env = envBase) {
  const result = spawnSync(command, args, {
    cwd, env, stdio: 'inherit', shell: needsShell(command),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed (exit ${result.status}): ${command} ${args.join(' ')}`);
}

function startChild(label, command, args, cwd, overrides = {}) {
  console.log(`\n[P19] Starting ${label}...`);
  const child = spawn(command, args, {
    cwd,
    env: { ...envBase, ...overrides },
    stdio: 'inherit',
    shell: needsShell(command),
  });
  children.push({ label, child });
  child.on('error', (error) => {
    console.error(`[P19] ${label} failed to start: ${error.message}`);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (code !== 0) {
      console.error(`[P19] ${label} stopped unexpectedly (code ${code ?? 'null'}, signal ${signal ?? 'none'}).`);
      shutdown(code ?? 1);
    }
  });
  return child;
}

async function waitForHttp(url, label, maxAttempts = 60) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (shuttingDown) throw new Error('Startup cancelled.');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) {
        console.log(`[P19] ${label} ready: ${url}`);
        return;
      }
    } catch { /* Server may still be starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timeout while waiting for ${label}: ${url}`);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = code;
  console.log('\n[P19] Encerrando os serviços locais...');
  for (const { child } of children) {
    if (!child.pid) continue;
    if (isWindows) {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
      killer.unref();
    } else {
      try { child.kill('SIGTERM'); } catch { /* Child already exited. */ }
    }
  }
  setTimeout(() => process.exit(code), 1200).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  const dependenciesReady = existsSync(path.join(root, 'node_modules', 'vite', 'package.json')) &&
    Object.values(apps).every((app) => existsSync(path.join(app, 'node_modules', 'react', 'package.json')));
  if (!dependenciesReady) {
    console.log('[P19] Dependências ausentes; instalando a central e os três produtos...');
    runSync(process.execPath, [path.join(root, 'scripts', 'setup-demo.mjs')], root);
  }

  runSync(process.execPath, [path.join(root, 'scripts', 'build-demo.mjs')], root);

  startChild('P15 Barber API + site', process.execPath, [path.join(apps.barber, 'server', 'index.mjs')], apps.barber, {
    PORT: '3015', HOST: '127.0.0.1', P15_LOCAL_DB_PATH: path.join(apps.barber, 'data', 'p19-demo-db.json'),
  });
  startChild('P18 Beauty API + site', process.execPath, [path.join(apps.beauty, 'server', 'index.mjs')], apps.beauty, {
    PORT: '3018', HOST: '127.0.0.1', P19_DEMO_MODE: 'true',
  });
  startChild('P16 Burger API', process.execPath, [path.join(apps.burger, 'server', 'index.mjs')], apps.burger, {
    P16_API_HOST: '127.0.0.1', P16_API_PORT: '3016', P19_DEMO_MODE: 'true',
  });

  await Promise.all([
    waitForHttp('http://127.0.0.1:3015/api/health', 'P15 Barber'),
    waitForHttp('http://127.0.0.1:3018/api/health', 'P18 Beauty'),
    waitForHttp('http://127.0.0.1:3016/api/health', 'P16 Burger API'),
  ]);

  console.log('\n[P19] Preparando exemplos de produtos, estoque, pedidos e financeiro para Burger...');
  runSync(process.execPath, [path.join(apps.burger, 'scripts', 'seed-demo.mjs')], apps.burger, {
    ...envBase, P16_API_URL: 'http://127.0.0.1:3016',
  });

  startChild('P16 Burger interface', npm, ['run', 'dev'], apps.burger, {});
  startChild('P19 commercial hub', npm, ['run', 'dev:hub'], root, {});

  await Promise.all([
    waitForHttp('http://127.0.0.1:5176', 'P16 Burger interface'),
    waitForHttp('http://127.0.0.1:5173', 'P19 Central'),
  ]);

  console.log('\n==============================================');
  console.log(' P19 — CENTRAL DE DEMONSTRAÇÕES 2R');
  console.log(' Central:  http://127.0.0.1:5173');
  console.log(' Barber:   http://127.0.0.1:3015');
  console.log(' Beauty:   http://127.0.0.1:3018');
  console.log(' Burger:   http://127.0.0.1:5176');
  console.log(' Dados fictícios e bancos locais isolados.');
  console.log(' Pressione Ctrl+C para encerrar todos os serviços.');
  console.log('==============================================\n');
}

main().catch((error) => {
  console.error(`\n[P19] Não foi possível iniciar a demonstração: ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});
