"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-border bg-surface p-6">
      <h1 className="text-base font-semibold">Something went wrong loading this page.</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Check your connection and try again. Nothing was changed.
      </p>
      <Button variant="secondary" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
