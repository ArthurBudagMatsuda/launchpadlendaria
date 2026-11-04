export const BETA_BRANCH = "feat/retry-stage-9-transactional-beta-vercel";
export const METADATA_URL = "https://retry-solana-devnet-beta.pages.dev";
export function vercelBetaEnvironment(
  input: Record<string, string | undefined>,
) {
  if (input.VERCEL === "1" && input.VERCEL_GIT_COMMIT_REF !== BETA_BRANCH)
    throw new Error(
      "This isolated Vercel project only builds the reviewed Stage 9 branch.",
    );
  if (input.VERCEL === "1" && input.VERCEL_ENV !== "preview")
    throw new Error(
      "Stage 9 authorizes preview deployments only. No production promotion.",
    );
  if (
    input.NEXT_PUBLIC_SOLANA_CLUSTER &&
    input.NEXT_PUBLIC_SOLANA_CLUSTER !== "devnet"
  )
    throw new Error("The Vercel beta refuses non-Devnet configuration.");
  if (input.NEXT_PUBLIC_BASE_PATH)
    throw new Error("The Vercel beta requires the domain root.");
  if (
    input.NEXT_PUBLIC_RETRY_METADATA_URL &&
    input.NEXT_PUBLIC_RETRY_METADATA_URL !== METADATA_URL
  )
    throw new Error("Use the existing reviewed Cloudflare metadata origin.");
  return {
    ...input,
    NEXT_TELEMETRY_DISABLED: "1",
    RETRY_STATIC_EXPORT: "1",
    NEXT_PUBLIC_BASE_PATH: "",
    NEXT_PUBLIC_RETRY_DEVNET_BETA: "1",
    NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
    NEXT_PUBLIC_ENABLE_LIVE_TRADING: "false",
    NEXT_PUBLIC_ENABLE_TOKEN_LAUNCH: "false",
    NEXT_PUBLIC_RETRY_METADATA_URL: METADATA_URL,
    NEXT_PUBLIC_RETRY_METADATA_AUTH: "wallet-devnet",
  };
}
