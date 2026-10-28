import { SearchX } from "lucide-react";
import type { ReactNode } from "react";
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <SearchX size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading content" className="skeleton-wrap">
      {[0, 1, 2].map((n) => (
        <div className="skeleton" key={n} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
