import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const apps = ['apps/barber', 'apps/beauty', 'apps/burger'];

function run(args, cwd) {
  console.log(`\n> ${npm} ${args.join(' ')}  [${path.relative(root, cwd) || '.'}]\n`);
  const result = spawnSync(npm, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed with exit code ${result.status}: ${args.join(' ')}`);
}

try {
  run(['ci'], root);
  for (const app of apps) run(['ci'], path.join(root, app));
  console.log('\nDependências instaladas. Execute npm run dev para iniciar a central e os três sistemas originais em modo demonstrativo.');
} catch (error) {
  console.error(`\nFalha ao preparar o P19: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
