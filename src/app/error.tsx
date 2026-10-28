"use client";
import { EmptyState } from "@/components/ui/feedback";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title="Let’s give that another try."
      action={
        <button className="button button-primary" onClick={reset}>
          Retry again
        </button>
      }
    >
      Something interrupted this page. Your wallet and funds are unaffected.
    </EmptyState>
  );
}
