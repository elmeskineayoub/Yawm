"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Keyboard, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import { dialogClass, overlayClass } from "@/components/ui/surfaces";
import { isShortcutEvent, navItems, nextNavItem } from "@/lib/keyboard";
import { cn } from "@/lib/utils";

/** Every shortcut Yawm has, in one place. Keep in step with the handlers it describes. */
const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "Anywhere",
    items: [
      { keys: ["q"], label: "Quick capture: an idea or a task" },
      { keys: ["/"], label: "Search everything" },
      { keys: ["?"], label: "Show these shortcuts" },
      { keys: ["Esc"], label: "Close a dialog, panel, or the immersive focus view" },
    ],
  },
  {
    title: "Lists",
    items: [
      { keys: ["j"], label: "Next item" },
      { keys: ["k"], label: "Previous item" },
      { keys: ["Enter"], label: "Open the selected item" },
    ],
  },
  {
    title: "Planner",
    items: [
      { keys: ["d", "w", "m", "y"], label: "Day, week, month, or year view" },
      { keys: ["t"], label: "Back to today" },
      { keys: ["←", "→"], label: "Previous or next period" },
    ],
  },
  {
    title: "Search results",
    items: [
      { keys: ["↑", "↓"], label: "Move between results" },
      { keys: ["Enter"], label: "Open the result" },
    ],
  },
];

/** Opens the shortcut help from anywhere (e.g. the sidebar button) without shared state. */
export const OPEN_SHORTCUTS_EVENT = "yawm:open-shortcuts";

/**
 * Global single-key shortcuts that aren't tied to one screen: "?" for this help, and j / k to
 * move through the rows of whatever list is on the page. Shortcuts never fire while typing or
 * over a dialog. There is no command palette by design.
 */
export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isShortcutEvent(event)) return;
      if (event.key === "?") {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (event.key !== "j" && event.key !== "k") return;
      const target = nextNavItem(navItems(), document.activeElement, event.key === "j" ? 1 : -1);
      if (!target) return;
      event.preventDefault();
      target.focus();
      target.scrollIntoView({ block: "nearest" });
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
    };
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content className={cn(dialogClass, "max-h-[85vh] max-w-lg overflow-y-auto")}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold">Keyboard shortcuts</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                Single keys work whenever you&apos;re not typing in a field.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="space-y-5">
            {GROUPS.map((group) => (
              <section key={group.title} aria-labelledby={`kbd-${group.title}`}>
                <h3 id={`kbd-${group.title}`} className="label-caps mb-1.5">
                  {group.title}
                </h3>
                <dl className="divide-y divide-border">
                  {group.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4 py-1.5"
                    >
                      <dt className="text-sm">{item.label}</dt>
                      <dd className="flex shrink-0 gap-1">
                        {item.keys.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A sidebar row that opens the shortcut help. Hidden on touch-only screens. */
export function ShortcutsButton({
  className,
  labelClass,
}: {
  className?: string;
  labelClass?: string;
}) {
  return (
    <button
      type="button"
      title="Keyboard shortcuts (?)"
      onClick={() => window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT))}
      className={cn(
        "flex h-9 w-full items-center rounded-md text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground [@media(hover:none)]:hidden",
        className,
      )}
    >
      <Keyboard aria-hidden className="size-4" />
      <span className={labelClass}>Keyboard shortcuts</span>
    </button>
  );
}
