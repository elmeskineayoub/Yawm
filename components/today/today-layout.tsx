"use client";

import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

/**
 * Today's two halves: what to do (tasks, habits) and when (schedule, focus, reflection). Side by
 * side from the lg breakpoint; on smaller screens one at a time, switched with a toggle, so the
 * schedule is one tap away instead of at the bottom of a long page.
 */
export function TodayLayout({ tasks, schedule }: { tasks: ReactNode; schedule: ReactNode }) {
  const [view, setView] = useState<"tasks" | "schedule">("tasks");
  return (
    <>
      <SegmentedControl
        label="Show"
        className="mb-6 lg:hidden"
        value={view}
        onChange={setView}
        items={[
          { value: "tasks", label: "Tasks" },
          { value: "schedule", label: "Schedule" },
        ]}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className={cn("min-w-0 space-y-8", view !== "tasks" && "max-lg:hidden")}>{tasks}</div>
        <aside
          aria-label="Schedule and focus"
          className={cn(
            "min-w-0 space-y-8 lg:sticky lg:top-8 lg:self-start",
            view !== "schedule" && "max-lg:hidden",
          )}
        >
          {schedule}
        </aside>
      </div>
    </>
  );
}
