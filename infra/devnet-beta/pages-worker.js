/** Same-origin gateway. Metadata authorization and validation remain in the existing Worker. */
const gateway = {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith("/v1/")) {
      if (!env.METADATA_SERVICE)
        return new Response("Metadata service is not configured.", {
          status: 503,
          headers: { "cache-control": "no-store" },
        });
      // Includes the signed Access assertion injected at the protected upload path.
      // The metadata Worker verifies it; the public GET paths need no cookie.
      return env.METADATA_SERVICE.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
export default gateway;
