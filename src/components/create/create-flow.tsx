"use client";
import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  CloudCheck,
  ImagePlus,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  emptyDraft,
  imageSignature,
  MAX_IMAGE_SIZE,
  validateDraft,
  type TokenDraft,
} from "@/lib/validation";
import { useTokenDraft } from "@/hooks/use-token-draft";
import { useApp } from "@/components/providers";
import { curveSummary } from "@/lib/meteora/curve";
import { Button } from "@/components/ui/button";
import { LaunchPanel } from "@/components/launch/launch-panel";
type Errors = Partial<Record<keyof TokenDraft, string>>;
export function CreateFlow() {
  const { draft, saveDraft } = useTokenDraft();
  const { notify } = useApp();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [uploading, setUploading] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const storageWarned = useRef(false);
  function save(next: TokenDraft | ((previous: TokenDraft) => TokenDraft)) {
    const saved = saveDraft(next);
    setPersisted(saved);
    if (!saved && !storageWarned.current) {
      notify(
        "Browser storage is unavailable or full. Your draft is kept in this tab only.",
        true,
      );
      storageWarned.current = true;
    }
  }
  function update(field: keyof TokenDraft, value: string) {
    save((previous) => ({ ...previous, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      if (
        file.size > MAX_IMAGE_SIZE ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      )
        throw new Error("Use PNG, JPEG or WebP, up to 2 MB.");
      const signature = imageSignature(
        new Uint8Array(await file.slice(0, 12).arrayBuffer()),
      );
      if (signature !== file.type)
        throw new Error("The image content doesn’t match its file type.");
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        throw new Error("We couldn’t open this image. Choose another file.");
      }
      const validSize =
        bitmap.width <= 4096 &&
        bitmap.height <= 4096 &&
        bitmap.width > 0 &&
        bitmap.height > 0;
      bitmap.close();
      if (!validSize)
        throw new Error("Choose an image no larger than 4096 × 4096 pixels.");
      const value = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      update("image", value);
      notify("Image added to your draft.");
    } catch (error) {
      setErrors((e) => ({
        ...e,
        image:
          error instanceof Error
            ? error.message
            : "Image upload failed. Try another file.",
      }));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }
  function goTo(next: number) {
    if (next > step) {
      const validation = validateDraft(draft);
      setErrors(validation);
      if (Object.keys(validation).length) {
        setStep(0);
        notify("Check the highlighted fields before continuing.", true);
        return;
      }
    }
    setStep(next);
  }
  function field(
    key: Exclude<keyof TokenDraft, "image">,
    label: string,
    placeholder: string,
    optional = false,
    maxLength = 2048,
  ) {
    return (
      <div className="form-field">
        <label className="field-label" htmlFor={key}>
          {label}
          <span>
            {optional
              ? "Optional"
              : key === "description"
                ? `${draft.description.length}/300`
                : "Required"}
          </span>
        </label>
        {key === "description" ? (
          <textarea
            id={key}
            value={draft[key]}
            placeholder={placeholder}
            maxLength={300}
            onChange={(e) => update(key, e.target.value)}
            aria-invalid={!!errors[key]}
            aria-describedby={errors[key] ? `${key}-error` : undefined}
          />
        ) : (
          <input
            id={key}
            value={draft[key]}
            placeholder={placeholder}
            maxLength={maxLength}
            onChange={(e) =>
              update(
                key,
                key === "symbol"
                  ? e.target.value.toUpperCase()
                  : e.target.value,
              )
            }
            aria-invalid={!!errors[key]}
            aria-describedby={errors[key] ? `${key}-error` : undefined}
            autoComplete="off"
            spellCheck={key === "name"}
            type={optional ? "url" : "text"}
          />
        )}
        {errors[key] ? (
          <p id={`${key}-error`} className="form-error">
            {errors[key]}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="create-page">
      <div className="page-heading">
        <div>
          <h1>
            Create your next beginning<span className="heading-dot">.</span>
          </h1>
          <p>A little idea. A new community. Your token on Solana.</p>
        </div>
        <span className="status-label">
          <LockKeyhole size={11} />
          Devnet · Mainnet locked
        </span>
      </div>
      <div className="create-layout">
        <section className="panel">
          <nav className="stepper" aria-label="Token creation steps">
            {["Token Details", "Preview", "Launch Summary"].map((s, i) => (
              <button
                key={s}
                onClick={() => goTo(i)}
                className={i === step ? "active" : i < step ? "completed" : ""}
                aria-current={i === step ? "step" : undefined}
              >
                <span>
                  {i < step ? (
                    <Check size={11} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                {s}
              </button>
            ))}
          </nav>
          <form
            noValidate
            className="create-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 2) goTo(step + 1);
            }}
          >
            {step === 0 ? (
              <>
                <h2>Make it yours.</h2>
                <p className="muted">
                  Start with a name, a symbol, and a little personality.
                </p>
                <div className="form-grid">
                  {field("name", "Token Name", "e.g. Orbit Cat", false, 32)}
                  {field("symbol", "Token Symbol", "e.g. ORBIT", false, 10)}
                </div>
                {field(
                  "description",
                  "Description",
                  "What’s the story behind your token?",
                )}
                <div className="form-field">
                  <label className="field-label" htmlFor="token-image">
                    Token Image<span>Required</span>
                  </label>
                  <label className="image-upload" htmlFor="token-image">
                    {draft.image ? (
                      <Image
                        className="image-preview"
                        src={draft.image}
                        alt="Your token image preview"
                        width={64}
                        height={64}
                        unoptimized
                      />
                    ) : (
                      <Upload size={25} />
                    )}
                    <strong>
                      {uploading
                        ? "Checking image…"
                        : draft.image
                          ? "Choose a different image"
                          : "Click to upload your token image"}
                    </strong>
                    <small>PNG, JPEG or WebP · Max 2 MB · Up to 4096 px</small>
                    <input
                      id="token-image"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={uploading}
                      onChange={upload}
                      aria-invalid={!!errors.image}
                      aria-describedby={
                        errors.image ? "image-error" : undefined
                      }
                    />
                  </label>
                  {errors.image ? (
                    <p className="form-error" id="image-error">
                      {errors.image}
                    </p>
                  ) : null}
                </div>
                <h3 className="optional-heading">
                  Around the internet{" "}
                  <span className="muted tiny">· optional</span>
                </h3>
                {field(
                  "website",
                  "Website",
                  "https://your-community.com",
                  true,
                )}
                <div className="form-grid">
                  {field(
                    "twitter",
                    "X / Twitter",
                    "https://x.com/yourtoken",
                    true,
                  )}
                  {field(
                    "telegram",
                    "Telegram",
                    "https://t.me/yourtoken",
                    true,
                  )}
                </div>
              </>
            ) : step === 1 ? (
              <>
                <h2>Looking like a fresh start.</h2>
                <p className="muted">
                  Review your details. You can go back and change anything.
                </p>
                <div className="flex items-center gap-4 mb-6">
                  {draft.image ? (
                    <Image
                      className="image-preview"
                      src={draft.image}
                      alt={draft.name}
                      width={64}
                      height={64}
                      unoptimized
                    />
                  ) : null}
                  <div>
                    <h2>{draft.name}</h2>
                    <span className="preview-symbol">${draft.symbol}</span>
                  </div>
                </div>
                <p className="preview-description">{draft.description}</p>
                <dl className="summary-list">
                  {[
                    ["Network", "Solana"],
                    ["Website", draft.website || "Not provided"],
                    ["X / Twitter", draft.twitter || "Not provided"],
                    ["Telegram", draft.telegram || "Not provided"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd className="break-all">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="notice-strip mt-6">
                  <CircleHelp size={16} />
                  This preview is saved locally. No token has been created yet.
                </p>
              </>
            ) : (
              <>
                <h2>Almost a new beginning.</h2>
                <p className="muted">
                  Review the launch terms, then sign one transaction that
                  creates your token on Solana.
                </p>
                <LaunchPanel draft={draft} />
              </>
            )}
            <div className="form-actions">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => goTo(step - 1)}
                >
                  <ArrowLeft size={14} />
                  Back
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    save(emptyDraft);
                    setErrors({});
                    notify("Draft cleared.");
                  }}
                >
                  <RotateCcw size={13} />
                  Reset draft
                </Button>
              )}
              {step < 2 ? (
                <Button type="submit" disabled={uploading}>
                  Continue to {step === 0 ? "Preview" : "Summary"}
                  <ArrowRight size={14} />
                </Button>
              ) : null}
            </div>
            <p className="draft-note">
              <CloudCheck size={12} />
              {persisted
                ? "Draft saved in this browser. A wallet is needed only to launch."
                : "Draft kept in this tab only. Browser storage unavailable."}
            </p>
          </form>
        </section>
        <aside className="create-preview">
          <p className="eyebrow">
            <Sparkles size={13} />
            LIVE PREVIEW
          </p>
          <div className="preview-card">
            {draft.image ? (
              <Image
                src={draft.image}
                width={70}
                height={70}
                alt="Token artwork"
                className="token-avatar mb-5"
                unoptimized
              />
            ) : (
              <div className="preview-avatar">
                <ImagePlus size={29} />
              </div>
            )}
            <h3>{draft.name || "Your token name"}</h3>
            <p className="preview-symbol">${draft.symbol || "TICKER"}</p>
            <p className="preview-description">
              {draft.description ||
                "Every token has a story. This is where yours begins."}
            </p>
            <span className="status-label">
              <span className="solana-mark" />
              New creation · Preview
            </span>
            <dl className="detail-list">
              <div>
                <dt>Supply</dt>
                <dd>1,000,000,000</dd>
              </div>
              <div>
                <dt>Starting FDV</dt>
                <dd>~{curveSummary().startFdvSol} SOL</dd>
              </div>
              <div>
                <dt>Bonding curve</dt>
                <dd>Not launched</dd>
              </div>
            </dl>
          </div>
          <p className="preview-note">
            <CircleHelp size={16} />
            Your preview updates as you type. Prices and progress appear once
            the token is live on its curve.
          </p>
        </aside>
      </div>
    </div>
  );
}
