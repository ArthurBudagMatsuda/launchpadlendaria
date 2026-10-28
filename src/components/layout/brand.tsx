import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="RETRY home">
      <svg
        viewBox="0 0 36 36"
        width="32"
        height="32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M27.2 13A10.5 10.5 0 0 0 9 10.5L5 15.5M5 7v8.5h8.5M8.8 23A10.5 10.5 0 0 0 27 25.5l4-5M31 29v-8.5h-8.5"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
      {!compact ? (
        <span>
          retry<span className="brand-dot">.</span>
        </span>
      ) : null}
    </Link>
  );
}
