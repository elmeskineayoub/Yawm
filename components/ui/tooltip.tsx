"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = RadixTooltip.Provider;

/**
 * Short hint for an unfamiliar control, shown on hover and keyboard focus. The trigger must already
 * have an accessible name (visible text or aria-label); the tooltip only supplements it.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  shortcut,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 flex items-center gap-2 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-overlay",
            "data-[state=delayed-open]:animate-[fade-in_120ms_ease-out]",
          )}
        >
          {content}
          {shortcut && (
            <kbd className="rounded border border-background/25 px-1 font-sans text-[0.6875rem] leading-4 opacity-80">
              {shortcut}
            </kbd>
          )}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
