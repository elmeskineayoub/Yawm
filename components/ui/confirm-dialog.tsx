"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "./button";

type ConfirmDialogProps = {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Resolves to an error message, or null on success. */
  onConfirm: () => Promise<string | null>;
};

/** Confirmation for destructive actions. The dialog stays open and shows the error on failure. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
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
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg">
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-2 text-sm text-muted-foreground">{description}</div>
          </Dialog.Description>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button
              className="bg-red-700 text-white hover:bg-red-800"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const message = await onConfirm();
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
