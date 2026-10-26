import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}
const files = await markdownFiles(new URL('../../../docs/protocol/', import.meta.url));
files.push(new URL('../README.md', import.meta.url));
let links = 0;
for (const path of files) {
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(/\]\(([^\s)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|#)/.test(target)) continue;
    const resolved = new URL(target, path);
    resolved.hash = '';
    await stat(fileURLToPath(resolved));
    links++;
  }
}
console.log(`Verified ${links} local documentation links in ${files.length} Markdown files`);
