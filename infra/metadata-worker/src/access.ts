import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";

export interface AccessConfig {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUDIENCE?: string;
}

export function accessConfigured(env: AccessConfig) {
  return (
    /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(
      env.ACCESS_TEAM_DOMAIN ?? "",
    ) && !!env.ACCESS_AUDIENCE?.trim()
  );
}

/** Only the configured Cloudflare issuer supplies keys; token URLs are ignored. */
export function accessVerifier(fetcher: typeof fetch) {
  const resolvers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
  return async (
    request: Request,
    env: AccessConfig,
  ): Promise<string | null> => {
    const token = request.headers.get("cf-access-jwt-assertion");
    if (!accessConfigured(env) || !token || token.length > 16_384) return null;
    try {
      const issuer = env.ACCESS_TEAM_DOMAIN!;
      let keys = resolvers.get(issuer);
      if (!keys) {
        keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
          [customFetch]: fetcher,
          timeoutDuration: 5_000,
          cacheMaxAge: 300_000,
        });
        if (resolvers.size >= 4)
          resolvers.delete(resolvers.keys().next().value!);
        resolvers.set(issuer, keys);
      }
      const { payload } = await jwtVerify(token, keys, {
        issuer,
        audience: env.ACCESS_AUDIENCE,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "iat", "sub"],
      });
      return typeof payload.sub === "string" && payload.sub
        ? payload.sub
        : null;
    } catch {
      return null;
    }
  };
}
