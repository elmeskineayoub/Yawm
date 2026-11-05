"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { dialogClass, overlayClass } from "./surfaces";

type ConfirmDialogProps = {
  /** The button that opens it. Omit when opening it from elsewhere (e.g. a menu item). */
  trigger?: ReactNode;
  /** Controlled open state, for dialogs opened from a menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Resolves to an error message, or null on success. */
  onConfirm: () => Promise<string | null>;
  /** Red confirm button (default). Use false for safe, reversible actions. */
  destructive?: boolean;
};

/** Confirmation for destructive actions. The dialog stays open and shows the error on failure. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
  open: controlledOpen,
  onOpenChange,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content className={cn(dialogClass, "max-w-md")}>
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-2 text-sm text-muted-foreground">{description}</div>
          </Dialog.Description>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button
              variant={destructive ? "danger" : "primary"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  let message: string | null;
                  try {
                    message = await onConfirm();
                  } catch {
                    message =
                      "Couldn't reach the server, so nothing was changed. Please try again.";
                  }
                  if (message) setError(message);
                  else setOpen(false);
                })
              }
            >
              {pending ? "Working…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
