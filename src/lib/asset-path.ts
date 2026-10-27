/** Public files need the same build-time prefix as Next.js routes on Pages. */
export function assetPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//")
    ? `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`
    : path;
}
