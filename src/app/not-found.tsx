import Link from "next/link";
import { EmptyState } from "@/components/ui/feedback";
export default function NotFound() {
  return (
    <EmptyState
      title="This one hasn’t launched. Yet."
      action={
        <Link href="/" className="button button-primary">
          Back to Discover
        </Link>
      }
    >
      We couldn’t find that page or token. A new beginning is a click away.
    </EmptyState>
  );
}
