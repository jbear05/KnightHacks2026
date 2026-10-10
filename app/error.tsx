"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// Any page whose API call fails (backend down, database unreachable) lands here instead of a blank screen.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState title="Couldn't load this page">
      <p>The mission data service didn't answer. Nothing was changed.</p>
      <p className="text-fg-muted type-body-sm">{error.digest ? `Reference ${error.digest}` : error.message}</p>
      <Button onClick={reset} className="mt-2 self-start">
        Try again
      </Button>
    </EmptyState>
  );
}
