import { copyFileSync, mkdirSync } from 'node:fs'

// tsc only emits JS/declarations; the stylesheet is shipped as-is.
mkdirSync(new URL('../dist', import.meta.url), { recursive: true })
copyFileSync(
  new URL('../src/react/styles.css', import.meta.url),
  new URL('../dist/styles.css', import.meta.url),
)
