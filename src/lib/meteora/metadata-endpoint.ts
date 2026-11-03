/** '/' means the beta's own HTTPS origin, resolved only when making a request. */
export function metadataEndpoint(
  value = process.env.NEXT_PUBLIC_RETRY_METADATA_URL,
) {
  if (value === "/") return "/";
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function metadataOrigin(endpoint = metadataEndpoint()) {
  if (!endpoint) return null;
  if (endpoint !== "/") return metadataEndpoint(endpoint);
  if (typeof window === "undefined" || window.location.protocol !== "https:")
    return null;
  return window.location.origin;
}
export function metadataSignInUrl() {
  const endpoint = metadataEndpoint();
  return endpoint ? `${endpoint === "/" ? "" : endpoint}/v1/metadata` : null;
}
