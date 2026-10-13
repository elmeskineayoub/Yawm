"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { dismissReminder } from "@/features/reminders/actions";
import { REMINDER_CATEGORY_LABELS, type Reminder } from "@/features/reminders/logic";
import { cn } from "@/lib/utils";

/**
 * The in-app reminder centre: a bell that lists reminders derived from due tasks, habits, and
 * upcoming time blocks. Dismissing one hides it immediately and records the dismissal so it does
 * not come back on refresh. Reminders only appear while the app is open.
 */
export function ReminderCenter({ reminders }: { reminders: Reminder[] }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = reminders.filter((r) => !hidden.has(r.key));
  const count = visible.length;

  const dismiss = (key: string) => {
    setHidden((h) => new Set(h).add(key));
    startTransition(async () => {
      const result = await dismissReminder(key);
      if (!result.ok) {
        toast.error(result.error);
        setHidden((h) => {
          const next = new Set(h);
          next.delete(key);
          return next;
        });
      }
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Reminders, ${count} active` : "Reminders"}
        aria-expanded={open}
        className="relative rounded p-2 text-muted-foreground hover:bg-surface-muted"
      >
        <Bell aria-hidden className="size-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground tabular-nums">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          <div className="border-b border-border px-4 py-2 text-sm font-semibold">Reminders</div>
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              You&rsquo;re all caught up.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-auto">
              {visible.map((r) => (
                <li key={r.key} className="flex items-start gap-2 px-3 py-2">
                  <Link
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className="min-w-0 flex-1 rounded px-1 py-0.5 hover:bg-surface-muted"
                  >
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.detail ?? REMINDER_CATEGORY_LABELS[r.category]}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismiss(r.key)}
                    aria-label={`Dismiss reminder: ${r.title}`}
                    className={cn(
                      "shrink-0 rounded px-2 py-1 text-xs text-muted-foreground",
                      "hover:bg-surface-muted hover:text-foreground",
                    )}
                  >
                    Dismiss
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Reminders show only while Yawm is open.
          </p>
        </div>
      )}
    </div>
  );
}
