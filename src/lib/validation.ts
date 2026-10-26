export interface TokenDraft {
  name: string;
  symbol: string;
  description: string;
  image: string;
  website: string;
  twitter: string;
  telegram: string;
}
export const emptyDraft: TokenDraft = {
  name: "",
  symbol: "",
  description: "",
  image: "",
  website: "",
  twitter: "",
  telegram: "",
};
export function validateDraft(draft: TokenDraft) {
  const errors: Partial<Record<keyof TokenDraft, string>> = {};
  if (draft.name.trim().length < 2 || draft.name.trim().length > 32)
    errors.name = "Use between 2 and 32 characters.";
  if (!/^[A-Z0-9]{2,10}$/.test(draft.symbol))
    errors.symbol = "Use 2–10 uppercase letters or numbers.";
  if (
    draft.description.trim().length < 10 ||
    draft.description.trim().length > 300
  )
    errors.description = "Use between 10 and 300 characters.";
  if (!isSafeImage(draft.image))
    errors.image = "Add a PNG, JPEG or WebP image (up to 2 MB).";
  for (const field of ["website", "twitter", "telegram"] as const) {
    if (!draft[field]) continue;
    try {
      const url = new URL(draft[field]);
      if (url.protocol !== "https:") throw new Error();
      if (
        field === "twitter" &&
        !["x.com", "twitter.com"].includes(url.hostname)
      )
        throw new Error();
      if (field === "telegram" && url.hostname !== "t.me") throw new Error();
    } catch {
      errors[field] =
        field === "website"
          ? "Enter a valid https:// URL."
          : `Enter a valid https://${field === "twitter" ? "x.com" : "t.me"}/ URL.`;
    }
  }
  return errors;
}
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
export function isSafeImage(value: string) {
  return (
    /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(value) &&
    value.length <= Math.ceil((MAX_IMAGE_SIZE * 4) / 3) + 100
  );
}
export function imageSignature(bytes: Uint8Array) {
  return bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
    ? "image/png"
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? "image/jpeg"
      : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
        ? "image/webp"
        : undefined;
}
export function restoreDraft(value: unknown): TokenDraft {
  if (!value || typeof value !== "object") return emptyDraft;
  const data = value as Record<string, unknown>;
  const result = { ...emptyDraft };
  for (const key of Object.keys(emptyDraft) as (keyof TokenDraft)[])
    if (typeof data[key] === "string")
      result[key] = (data[key] as string).slice(
        0,
        key === "image"
          ? Math.ceil((MAX_IMAGE_SIZE * 4) / 3) + 100
          : key === "description"
            ? 300
            : key === "name"
              ? 32
              : key === "symbol"
                ? 10
                : 2048,
      );
  if (!isSafeImage(result.image)) result.image = "";
  return result;
}
