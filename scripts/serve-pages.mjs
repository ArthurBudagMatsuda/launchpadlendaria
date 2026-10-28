// Serves the static export in out/ the way GitHub Pages does: under the
// repository base path, index.html for folders, a redirect when the trailing
// slash is missing and out/404.html for unknown paths. Used by the browser
// tests and to preview `pnpm build:pages` locally.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../out/", import.meta.url));
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/launchpadlendaria";
const port = Number(process.env.PORT ?? 4174);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};
async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    path = "";
  }
  if (path === "/" || path === basePath) {
    res.writeHead(301, { Location: `${basePath}/` }).end();
    return;
  }
  let file = path.startsWith(`${basePath}/`)
    ? normalize(join(root, path.slice(basePath.length)))
    : "";
  if (file && !file.startsWith(root)) file = "";
  if (file && (await isDirectory(file))) {
    if (!path.endsWith("/")) {
      res.writeHead(301, { Location: `${pathname}/` }).end();
      return;
    }
    file = join(file, "index.html");
  }
  try {
    if (!file || file.endsWith(sep)) throw new Error("not found");
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    const body = await readFile(join(root, "404.html")).catch(() => "");
    res.writeHead(404, { "Content-Type": types[".html"] }).end(body);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving out/ at http://127.0.0.1:${port}${basePath}/`);
});
