import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const projects = [
  ['P15 Barber original', 'apps/barber'],
  ['P18 Beauty original', 'apps/beauty'],
  ['P16 Burger original', 'apps/burger'],
  ['Central P19', '.'],
];
const env = {
  ...process.env,
  NODE_ENV: 'development',
  P19_DEMO_MODE: 'true',
  // Explicitly blank connection settings make the copies ignore inherited or local database credentials.
  DB_HOST: '',
  DB_PORT: '',
  DB_USER: '',
  DB_PASSWORD: '',
  DB_NAME: '',
  DB_CONNECTION_LIMIT: '',
  TURNSTILE_SECRET_KEY: '',
  AUTH_SECRET: 'p19-local-demo-secret-not-for-production-2026',
};

for (const [label, relativeDir] of projects) {
  const cwd = path.join(root, relativeDir);
  console.log(`\n========== Building ${label} ==========\n`);
  const result = spawnSync(npm, ['run', 'build'], {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`\nBuild failed for ${label} (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}
console.log('\nTodos os projetos foram compilados com sucesso.');
