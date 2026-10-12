"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import {
  deleteCard,
  removeCardImage,
  setCardArchived,
  updateCard,
} from "@/features/vision/actions";
import { IMAGE_TYPES } from "@/features/vision/logic";
import type { VisionCard } from "@/features/vision/queries";
import { cn } from "@/lib/utils";
import { useImageUpload } from "./use-image-upload";

export type Option = { id: string; name: string };

/** Edits one card in a side panel: text, image, alt text, goal, area, archive, delete. */
export function CardPanel({
  card,
  areas,
  goals,
  onClose,
}: {
  card: VisionCard | null;
  areas: Option[];
  goals: Option[];
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={card !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background p-5 shadow-xl">
          {card && (
            <CardForm key={card.id} card={card} areas={areas} goals={goals} onClose={onClose} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CardForm({
  card,
  areas,
  goals,
  onClose,
}: {
  card: VisionCard;
  areas: Option[];
  goals: Option[];
  onClose: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const { upload, uploading } = useImageUpload();
  const busy = pending || uploading;

  const finish = (message: string) => {
    toast.success(message);
    router.refresh();
    onClose();
  };

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Dialog.Title className="text-base font-semibold">Edit card</Dialog.Title>
        <Dialog.Close asChild>
          <button
            type="button"
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-surface-muted"
          >
            <X aria-hidden className="size-4" />
          </button>
        </Dialog.Close>
      </div>
      <Dialog.Description className="mt-1 text-sm text-muted-foreground">
        Images are private to your workspace.
      </Dialog.Description>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          startTransition(async () => {
            const result = await updateCard(card.id, {
              title: form.get("title") as string,
              body: form.get("body") as string,
              image_alt: form.get("image_alt") as string,
              area_id: form.get("area_id") as string,
              goal_id: form.get("goal_id") as string,
            });
            if (!result.ok) return setError(result.error);
            finish("Card saved");
          });
        }}
      >
        <div className="space-y-2">
          {card.image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- private signed URL
            <img
              src={card.image_url}
              alt={card.image_alt ?? ""}
              className="aspect-[4/3] w-full rounded-md object-cover"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="px-3 py-1 text-xs"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : card.image_path ? "Replace image" : "Add image"}
            </Button>
            {card.image_path && (
              <Button
                variant="ghost"
                className="px-3 py-1 text-xs"
                disabled={busy}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeCardImage(card.id);
                    if (!result.ok) return setError(result.error);
                    finish("Image removed");
                  })
                }
              >
                Remove image
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            aria-label="Choose an image for this card"
            accept={Object.keys(IMAGE_TYPES).join(",")}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              startTransition(async () => {
                const problem = await upload(card.id, file, card.image_alt ?? card.title);
                if (problem) return setError(problem);
                finish(card.image_path ? "Image replaced" : "Image added");
              });
            }}
          />
        </div>

        <Field id={`${id}-title`} label="Title">
          <input
            id={`${id}-title`}
            name="title"
            maxLength={120}
            defaultValue={card.title ?? ""}
            className={controlClass}
          />
        </Field>
        <Field id={`${id}-body`} label="Text (optional)">
          <textarea
            id={`${id}-body`}
            name="body"
            rows={3}
            maxLength={1000}
            defaultValue={card.body ?? ""}
            className={controlClass}
          />
        </Field>
        {card.image_path && (
          <Field
            id={`${id}-alt`}
            label="Image description"
            hint="Read aloud by screen readers in place of the image."
          >
            <input
              id={`${id}-alt`}
              name="image_alt"
              maxLength={300}
              defaultValue={card.image_alt ?? ""}
              className={controlClass}
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${id}-goal`} label="Goal">
            <select
              id={`${id}-goal`}
              name="goal_id"
              defaultValue={card.goal_id ?? ""}
              className={controlClass}
            >
              <option value="">None</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-area`} label="Life area">
            <select
              id={`${id}-area`}
              name="area_id"
              defaultValue={card.area_id ?? ""}
              className={controlClass}
            >
              <option value="">None</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                startTransition(async () => {
                  const result = await setCardArchived(card.id, card.archived_at === null);
                  if (!result.ok) return setError(result.error);
                  finish(card.archived_at ? "Card restored" : "Card archived");
                })
              }
            >
              {card.archived_at ? "Restore" : "Archive"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              className={cn(confirmDelete && "text-red-700 dark:text-red-400")}
              onClick={() =>
                confirmDelete
                  ? startTransition(async () => {
                      const result = await deleteCard(card.id);
                      if (!result.ok) return setError(result.error);
                      finish("Card deleted");
                    })
                  : setConfirmDelete(true)
              }
            >
              {confirmDelete ? "Confirm delete" : "Delete"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button type="submit" disabled={busy}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
