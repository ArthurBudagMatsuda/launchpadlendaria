/** The dedicated beta build is Devnet-only. Normal historical builds are unchanged. */
export function isDevnetBeta() {
  return process.env.NEXT_PUBLIC_RETRY_DEVNET_BETA === "1";
}
