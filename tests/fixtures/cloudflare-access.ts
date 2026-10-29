import { exportJWK, generateKeyPair, SignJWT } from "jose";

/** Test-only identity provider. Real signatures, fake Access account/JWKS. */
export async function accessFixture() {
  const issuer = "https://retry-fixture.cloudflareaccess.com";
  const audience = "retry-devnet-test-audience";
  const pair = await generateKeyPair("RS256", { extractable: true });
  const jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: "test-key",
    alg: "RS256",
    use: "sig",
  };
  const issue = (
    options: { issuer?: string; audience?: string; expiration?: number } = {},
  ) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(options.issuer ?? issuer)
      .setAudience(options.audience ?? audience)
      .setSubject("test-operator")
      .setIssuedAt()
      .setExpirationTime(
        options.expiration ?? Math.floor(Date.now() / 1000) + 3600,
      )
      .sign(pair.privateKey);
  const fetcher = (async (input: RequestInfo | URL) => {
    if (String(input) !== `${issuer}/cdn-cgi/access/certs`)
      throw new Error("Only the fixture issuer may supply test keys.");
    return Response.json({ keys: [jwk] });
  }) as typeof fetch;
  return { issuer, audience, issue, fetcher, token: await issue() };
}

/** Stand-in for the Cloudflare rate-limit binding; never deployed. */
export function rateLimitFixture(limit = 10) {
  let count = 0;
  return {
    async limit() {
      return { success: ++count <= limit };
    },
  };
}
