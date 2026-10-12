import type { ProgressSummary } from "@/features/tasks/logic";

export function ProgressBar({ progress, label }: { progress: ProgressSummary; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={`${progress.done} of ${progress.total} tasks done`}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {progress.done}/{progress.total}
      </span>
    </div>
  );
}
