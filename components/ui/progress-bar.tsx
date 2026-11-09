import type { ProgressSummary } from "@/features/tasks/logic";
import { Meter } from "./meter";

/** Task progress: the shared meter plus a done/total count. */
export function ProgressBar({ progress, label }: { progress: ProgressSummary; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Meter
        percent={progress.percent}
        label={label}
        valueText={`${progress.done} of ${progress.total} tasks done`}
        className="flex-1"
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        {progress.done}/{progress.total}
      </span>
    </div>
  );
}
