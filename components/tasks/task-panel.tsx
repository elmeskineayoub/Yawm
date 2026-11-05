"use client";

import { Maximize2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Sheet, SheetClose, SheetTitle } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * The side panel a task opens in when you click it anywhere in the app (an intercepted route; a
 * direct visit or refresh shows the full page instead). Closing goes back, so the page underneath
 * is exactly as you left it, and browser Back/Forward close and reopen the panel.
 *
 * A parallel-route slot keeps its last content on client-side navigation, so after navigating
 * elsewhere this would stay mounted. Rather than a catch-all slot route (which would claim every
 * URL for this layout, including /login in another route group), the panel hides itself as soon
 * as the URL is no longer its task.
 */
export function TaskPanel({
  taskId,
  title,
  children,
}: {
  taskId: string;
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname !== `/tasks/${taskId}`) return null;
  return (
    <Sheet open onOpenChange={(open) => !open && router.back()} size="lg">
      <SheetTitle className="sr-only">{title}</SheetTitle>
      <div className="mb-4 flex items-center justify-end gap-1">
        <Tooltip content="Open as page">
          {/* A plain link (full page load), so the page renders instead of the panel again. */}
          <a
            href={`/tasks/${taskId}`}
            aria-label="Open as page"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <Maximize2 aria-hidden className="size-4" />
          </a>
        </Tooltip>
        <SheetClose />
      </div>
      {children}
    </Sheet>
  );
}
