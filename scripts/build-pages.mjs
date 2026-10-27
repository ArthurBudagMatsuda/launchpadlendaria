import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/launchpadlendaria";
if (!/^(\/[A-Za-z0-9._-]+)*$/.test(basePath)) {
  throw new Error(
    "NEXT_PUBLIC_BASE_PATH must be an empty string or a path without a trailing slash.",
  );
}
const build = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      RETRY_STATIC_EXPORT: "1",
      NEXT_PUBLIC_BASE_PATH: basePath,
    },
  },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
await writeFile("out/.nojekyll", "");
