// The one entry point to the Meteora DAMM v2 (cp_amm) SDK. Like the DBC SDK
// it calls the Node `Buffer` global, so the polyfill is installed first. Only
// code that trades or inspects a graduated pool imports this module, and the
// UI loads it lazily, so pages that never touch DAMM v2 do not download it.
import "./buffer-polyfill";
export * from "@meteora-ag/cp-amm-sdk";
