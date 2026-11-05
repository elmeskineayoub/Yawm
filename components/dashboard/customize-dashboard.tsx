"use client";

import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { popoverClass } from "@/components/ui/surfaces";
import { saveDashboardPrefs } from "@/features/dashboard/actions";
import { DASHBOARD_SECTIONS, type DashboardSection } from "@/features/dashboard/sections";
import { cn } from "@/lib/utils";

/**
 * Show or hide Dashboard sections. Each change saves to the user's profile at once; "Saved"
 * appears only after the server confirmed it, and a failed save puts the checkbox back.
 */
export function CustomizeDashboard({
  hidden: initialHidden,
  available,
}: {
  hidden: DashboardSection[];
  /** False until the dashboard_prefs migration is applied; the control explains instead of failing. */
  available: boolean;
}) {
  const [hidden, setHidden] = useState(() => new Set(initialHidden));
  const [status, setStatus] = useState<{ tone: "muted" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (key: DashboardSection, show: boolean) => {
    const previous = new Set(hidden);
    const next = new Set(hidden);
    if (show) next.delete(key);
    else next.add(key);
    setHidden(next);
    setStatus({ tone: "muted", text: "Saving…" });
    startTransition(async () => {
      let error: string | null;
      try {
        const result = await saveDashboardPrefs({ hidden: [...next] });
        error = result.ok ? null : result.error;
      } catch {
        error = "Couldn't reach the server. Not saved.";
      }
      if (error) {
        setHidden(previous);
        setStatus({ tone: "error", text: error });
      } else {
        setStatus({ tone: "muted", text: "Saved" });
      }
    });
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm">
          <SlidersHorizontal aria-hidden className="size-4" />
          Customize
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className={cn(popoverClass, "w-80 max-w-[calc(100vw-2rem)] p-4")}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Dashboard sections</h2>
            <span
              role="status"
              aria-live="polite"
              className={cn(
                "text-xs",
                status?.tone === "error" ? "text-danger" : "text-muted-foreground",
              )}
            >
              {status?.tone === "muted" ? status.text : ""}
            </span>
          </div>
          {!available ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Saving your layout isn&apos;t available yet: the database needs the update that adds
              it (migration 20261106090000). Every section is shown until then.
            </p>
          ) : (
            <fieldset className="mt-3 space-y-2.5" disabled={pending}>
              <legend className="sr-only">Show these sections</legend>
              {DASHBOARD_SECTIONS.map((section) => (
                <label key={section.key} className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4"
                    checked={!hidden.has(section.key)}
                    onChange={(e) => toggle(section.key, e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">{section.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {section.description}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {status?.tone === "error" && (
            <p role="alert" className="mt-3 text-xs text-danger">
              {status.text}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
