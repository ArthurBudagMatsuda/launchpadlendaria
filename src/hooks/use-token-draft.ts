"use client";
import { useMemo, useSyncExternalStore } from "react";
import { emptyDraft, restoreDraft, type TokenDraft } from "@/lib/validation";
const KEY = "retry:token-draft:v1";
const EVENT = "retry:draft-change";
let memoryDraft: string | undefined;
function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      memoryDraft = undefined;
      onChange();
    }
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
function snapshot() {
  if (memoryDraft !== undefined) return memoryDraft;
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
export function useTokenDraft() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const draft = useMemo(() => {
    try {
      return restoreDraft(JSON.parse(raw));
    } catch {
      return emptyDraft;
    }
  }, [raw]);
  function saveDraft(
    next: TokenDraft | ((previous: TokenDraft) => TokenDraft),
  ) {
    let previous = emptyDraft;
    try {
      previous = restoreDraft(JSON.parse(snapshot()));
    } catch {
      /* Empty or invalid stored draft. */
    }
    const value = JSON.stringify(
      typeof next === "function" ? next(previous) : next,
    );
    memoryDraft = value;
    let saved = true;
    try {
      localStorage.setItem(KEY, value);
    } catch {
      saved = false;
    }
    window.dispatchEvent(new Event(EVENT));
    return saved;
  }
  return { draft, saveDraft };
}
