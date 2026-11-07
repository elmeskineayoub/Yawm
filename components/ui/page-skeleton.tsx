import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

/*
 * Route-level loading placeholders, shaped like the page that is coming so the layout doesn't
 * jump when it arrives. Each is one role="status" region with a plain label; the blocks inside
 * are decorative.
 */

function Header({ actions = 0, meta = false }: { actions?: number; meta?: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
        {meta && <Skeleton className="h-3 w-40" />}
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
      )}
    </div>
  );
}

const widths = ["w-2/3", "w-1/2", "w-3/5", "w-3/4", "w-2/5"];

export function Rows({ rows = 6, check = true }: { rows?: number; check?: boolean }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          {check && <Skeleton className="size-4 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className={cn("h-3.5", widths[i % widths.length])} />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionBlock({ rows = 3, check = true }: { rows?: number; check?: boolean }) {
  return (
    <div>
      <Skeleton className="mb-2 h-4 w-28" />
      <Rows rows={rows} check={check} />
    </div>
  );
}

function Aside({ blocks = 2 }: { blocks?: number }) {
  return (
    <div className="space-y-8">
      {Array.from({ length: blocks }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

type Shape =
  /** Header, a toolbar, then a list (Tasks, Inbox, Projects, Habits, Goals). */
  | "list"
  /** Header, then a main column with sections and a side column (Today, project/goal pages). */
  | "split"
  /** Header, then stacked sections (Dashboard, Reviews, Settings, detail pages). */
  | "sections"
  /** A calendar-like grid (Planner). */
  | "grid"
  /** A centred timer (Focus). */
  | "timer";

export function PageSkeleton({ shape, label }: { shape: Shape; label: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      {shape === "list" && (
        <>
          <Header actions={1} />
          <div className="mb-4 flex gap-2">
            <Skeleton className="h-8 w-56 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="max-w-4xl">
            <Rows rows={8} />
          </div>
        </>
      )}
      {shape === "split" && (
        <>
          <Header meta />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-10">
              <SectionBlock rows={3} />
              <SectionBlock rows={4} />
            </div>
            <Aside />
          </div>
        </>
      )}
      {shape === "sections" && (
        <>
          <Header actions={1} />
          <div className="max-w-4xl space-y-10">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-7 w-14" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
            <SectionBlock rows={3} check={false} />
            <SectionBlock rows={3} check={false} />
          </div>
        </>
      )}
      {shape === "grid" && (
        <>
          <Header actions={2} />
          <Skeleton className="mb-4 h-8 w-64" />
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border">
            {Array.from({ length: 21 }, (_, i) => (
              <div key={i} className="h-24 space-y-1.5 bg-background p-2">
                <Skeleton className="h-3 w-5" />
                {i % 3 === 0 && <Skeleton className="h-3 w-full" />}
              </div>
            ))}
          </div>
        </>
      )}
      {shape === "timer" && (
        <>
          <Header actions={2} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex flex-col items-center">
              <Skeleton className="size-[min(18rem,78vw)] rounded-full" />
              <Skeleton className="mt-6 h-9 w-24" />
              <div className="mt-8 grid w-full max-w-xl gap-4 sm:grid-cols-2">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            </div>
            <Aside blocks={3} />
          </div>
        </>
      )}
    </div>
  );
}
