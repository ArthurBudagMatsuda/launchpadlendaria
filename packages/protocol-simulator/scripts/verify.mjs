import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tests = (await readdir(new URL('../test/', import.meta.url)))
  .filter(name => name.endsWith('.test.mjs')).sort().map(name => `test/${name}`);
if (tests.length === 0) throw new Error('NO_TEST_FILES');
for (const args of [['scripts/check-docs.mjs'], ['--test', ...tests], ['src/run.mjs', '--check']]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
