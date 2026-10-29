import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apps = {
  barber: path.join(root, 'apps', 'barber'),
  beauty: path.join(root, 'apps', 'beauty'),
  burger: path.join(root, 'apps', 'burger'),
};
const children = [];
const baseEnv = {
  ...process.env,
  NODE_ENV: 'development',
  P19_DEMO_MODE: 'true',
  DB_HOST: '', DB_PORT: '', DB_USER: '', DB_PASSWORD: '', DB_NAME: '', DB_CONNECTION_LIMIT: '',
  TURNSTILE_SECRET_KEY: '',
  ADMIN_USERS_JSON: '', ADMIN_LOGIN_ID: '', ADMIN_PASSWORD_HASH: '', ADMIN_PASSWORD: '', ADMIN_AUTH_SECRET: '',
  AUTH_SECRET: 'p19-local-demo-secret-not-for-production-2026',
};

function start(label, cwd, entry, overrides) {
  const child = spawn(process.execPath, [path.join(cwd, entry)], {
    cwd, env: { ...baseEnv, ...overrides }, stdio: 'inherit',
  });
  children.push({ label, child });
  child.on('error', (error) => console.error(`[${label}] ${error.message}`));
  return child;
}

async function waitHttp(url, label) {
  for (let i = 0; i < 80; i += 1) {
    const stopped = children.find(({ child }) => child.exitCode !== null);
    if (stopped) throw new Error(`${stopped.label} exited before becoming ready.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response;
    } catch { /* The local service is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

async function readDb(app, name) {
  return JSON.parse(await readFile(path.join(app, 'data', name), 'utf8'));
}

async function stopAll() {
  for (const { child } of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  await Promise.all(children.map(({ child }) => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(resolve, 1500);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  })));
}

try {
  start('P15 Barber demo', apps.barber, 'server/index.mjs', { PORT: '3025', HOST: '127.0.0.1' });
  start('P18 Beauty demo', apps.beauty, 'server/index.mjs', { PORT: '3028', HOST: '127.0.0.1' });
  start('P16 Burger demo API', apps.burger, 'server/index.mjs', { P16_API_HOST: '127.0.0.1', P16_API_PORT: '3026' });

  const [barberHealth, beautyHealth, burgerHealth] = await Promise.all([
    waitHttp('http://127.0.0.1:3025/api/health', 'P15'),
    waitHttp('http://127.0.0.1:3028/api/health', 'P18'),
    waitHttp('http://127.0.0.1:3026/api/health', 'P16'),
  ]);
  assert.equal(barberHealth.status, 200);
  assert.equal(beautyHealth.status, 200);
  assert.equal(burgerHealth.status, 200);

  const [barberServicesResponse, beautyServicesResponse] = await Promise.all([
    fetch('http://127.0.0.1:3025/api/public/services'),
    fetch('http://127.0.0.1:3028/api/public/services'),
  ]);
  const barberServices = await barberServicesResponse.json();
  const beautyServices = await beautyServicesResponse.json();
  assert.ok(barberServices.services?.length >= 5, 'P15 should serve its native demo service catalog');
  assert.ok(beautyServices.services?.length >= 5, 'P18 should serve the fictitious 2R Beauty demo catalog');

  const p16SeedResponse = await fetch('http://127.0.0.1:3026/api/admin/demo-seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(p16SeedResponse.status, 200, 'P16 should allow its local demo seed endpoint');
  const p16Seed = await p16SeedResponse.json();
  assert.ok((p16Seed.newProducts ?? p16Seed.products) > 0, 'P16 demo must have fictitious products/stock');
  assert.ok((p16Seed.newOrders ?? p16Seed.orders) > 0, 'P16 demo must have fictitious orders');

  const [barberDb, beautyDb, burgerDb] = await Promise.all([
    readDb(apps.barber, 'p19-demo-db.json'),
    readDb(apps.beauty, 'p19-demo-db.json'),
    readDb(apps.burger, 'p19-demo-db.json'),
  ]);
  assert.ok(barberDb.bookingGroups?.length >= 2, 'P15 should seed fictitious booking groups');
  assert.ok(barberDb.financialEntries?.length >= 1, 'P15 should show the linked fictitious receipt');
  assert.ok(barberDb.payables?.length >= 1, 'P15 should show a fictitious payable');
  assert.ok(beautyDb.appointments?.length >= 2, 'P18 should seed fictitious appointments');
  assert.ok(beautyDb.financial_entries?.length >= 2, 'P18 should show income linked to completed demo service plus an expense');
  assert.ok(beautyDb.payables?.length >= 1, 'P18 should show a fictitious payable');
  assert.ok(burgerDb.products?.length >= 1 && burgerDb.orders?.length >= 1, 'P16 demo seed must write data into its own isolated store');

  console.log('\nP19 runtime integration passed: original APIs respond and each copy has its own fictitious data store.');
} finally {
  await stopAll();
}
