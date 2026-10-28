import { restoreDraft } from "./validation";
export const DRAFT_KEY = "retry:solana:token-draft:v2";
export const LEGACY_DRAFT_KEY = "retry:token-draft:v1";
/** Copy compatible metadata once. Preserve the old draft and unrelated app data. */
export function migrateLegacyDraft(
  storage: Pick<Storage, "getItem" | "setItem">,
) {
  try {
    if (storage.getItem(DRAFT_KEY) !== null) return;
    const legacy = storage.getItem(LEGACY_DRAFT_KEY);
    if (legacy)
      storage.setItem(
        DRAFT_KEY,
        JSON.stringify(restoreDraft(JSON.parse(legacy))),
      );
  } catch {
    /* Storage unavailable or invalid metadata: the existing draft is retained. */
  }
}
