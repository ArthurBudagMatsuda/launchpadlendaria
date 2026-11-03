/** Public deployment settings only. No API tokens, JWTs or private keys belong here. */
export interface BetaSettings {
  accountId: string;
  kvNamespaceId: string;
  rateNamespaceId: string;
  pagesProject: string;
  workerName: string;
  publicOrigin: string;
  accessTeamDomain: string;
  accessAudience: string;
}
export function validateBetaSettings(value: unknown): BetaSettings {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected public deployment settings.");
  const data = value as Record<string, unknown>;
  const keys = [
    "accountId",
    "kvNamespaceId",
    "rateNamespaceId",
    "pagesProject",
    "workerName",
    "publicOrigin",
    "accessTeamDomain",
    "accessAudience",
  ];
  if (
    Object.keys(data).some((key) => !keys.includes(key)) ||
    keys.some((key) => typeof data[key] !== "string")
  )
    throw new Error(
      "Only the documented public settings are accepted; do not put credentials in this file.",
    );
  const config = data as unknown as BetaSettings;
  if (
    ![config.accountId, config.kvNamespaceId].every(
      (id) => /^[a-f0-9]{32}$/.test(id) && !/^0+$/.test(id),
    )
  )
    throw new Error("Real account and KV IDs are required.");
  if (
    !/^[1-9][0-9]{0,9}$/.test(config.rateNamespaceId) ||
    BigInt(config.rateNamespaceId) > 4294967295n
  )
    throw new Error("Choose an unused positive rate-limit namespace ID.");
  if (
    !/^retry-[a-z0-9-]{1,40}-beta$/.test(config.pagesProject) ||
    !/^retry-metadata-[a-z0-9-]{1,35}-beta$/.test(config.workerName)
  )
    throw new Error(
      "Use dedicated retry-...-beta resource names, after checking for existing resources.",
    );
  if (config.publicOrigin !== `https://${config.pagesProject}.pages.dev`)
    throw new Error(
      "PUBLIC_URL must be the real, stable HTTPS hostname of the isolated Pages beta project.",
    );
  if (
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(
      config.accessTeamDomain,
    ) ||
    !/^[a-f0-9]{64}$/.test(config.accessAudience)
  )
    throw new Error(
      "Real Cloudflare Access issuer and application AUD are required.",
    );
  return config;
}
