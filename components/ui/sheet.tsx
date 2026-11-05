"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { overlayClass } from "./surfaces";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Wider panels for detail views; default is 28rem. */
  size?: "md" | "lg";
  className?: string;
};

/**
 * A side panel that slides in from the right: the contextual detail surface used instead of
 * full-page navigation. Modal (focus is trapped, Escape closes). Content provides its own
 * `SheetTitle` so the dialog has an accessible name.
 */
export function Sheet({ open, onOpenChange, children, size = "md", className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-y-auto border-l border-border bg-surface p-5 shadow-overlay data-[state=open]:animate-[sheet-in_180ms_ease-out] sm:p-6",
            size === "md" ? "max-w-md" : "max-w-xl",
            className,
          )}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Title row with a close button. */
export function SheetHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-2">
        <Dialog.Title className="min-w-0 text-base font-semibold break-words">{title}</Dialog.Title>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <SheetClose />
        </div>
      </div>
      {description ? (
        <Dialog.Description className="mt-1 text-sm text-muted-foreground">
          {description}
        </Dialog.Description>
      ) : null}
    </div>
  );
}

export function SheetClose({ label = "Close" }: { label?: string }) {
  return (
    <Dialog.Close asChild>
      <button
        type="button"
        aria-label={label}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        <X aria-hidden className="size-4" />
      </button>
    </Dialog.Close>
  );
}

export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;
