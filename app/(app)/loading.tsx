export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      <div className="h-7 w-40 animate-pulse rounded bg-surface-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
    </div>
  );
}
