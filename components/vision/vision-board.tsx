"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { controlClass } from "@/components/ui/field";
import { createCard, moveCard } from "@/features/vision/actions";
import { IMAGE_TYPES } from "@/features/vision/logic";
import type { VisionCard } from "@/features/vision/queries";
import { cn } from "@/lib/utils";
import { CardPanel, type Option } from "./card-panel";
import { useImageUpload } from "./use-image-upload";

/** The board: add a text or image card inline, reorder by drag or with the arrow buttons. */
export function VisionBoard({
  cards,
  areas,
  goals,
  defaults,
}: {
  cards: VisionCard[];
  areas: Option[];
  goals: Option[];
  /** The current filter, applied to new cards. */
  defaults: { area_id: string | null; goal_id: string | null };
}) {
  const id = useId();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<VisionCard | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { upload, uploading } = useImageUpload();

  const addText = () =>
    startTransition(async () => {
      const result = await createCard({ title: text, ...defaults });
      if (!result.ok) return void toast.error(result.error);
      setText("");
      toast.success("Card added");
    });

  const addImage = (file: File) =>
    startTransition(async () => {
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Image";
      const created = await createCard({ title: text.trim() || name, ...defaults });
      if (!created.ok) return void toast.error(created.error);
      const problem = await upload(created.data.id, file, text.trim() || name);
      setText("");
      if (problem) toast.error(`Card added without its image: ${problem}`);
      else toast.success("Image card added");
      router.refresh();
    });

  const move = (cardId: string, beforeId: string | null) =>
    startTransition(async () => {
      const result = await moveCard(cardId, beforeId);
      if (!result.ok) toast.error(result.error);
    });

  const busy = pending || uploading;

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) addText();
        }}
      >
        <label htmlFor={`${id}-text`} className="sr-only">
          Add a card
        </label>
        <input
          id={`${id}-text`}
          value={text}
          maxLength={120}
          disabled={busy}
          placeholder="Add a card: a word, a quote, a place…"
          onChange={(e) => setText(e.target.value)}
          className={cn(controlClass, "min-w-0 flex-1 basis-60")}
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-md border border-border px-3 text-sm hover:bg-surface-muted disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-surface-muted disabled:opacity-50"
        >
          <ImagePlus aria-hidden className="size-4" />
          {uploading ? "Uploading…" : "Add image"}
        </button>
        <input
          ref={fileRef}
          type="file"
          aria-label="Choose an image for a new card"
          accept={Object.keys(IMAGE_TYPES).join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) addImage(file);
          }}
        />
      </form>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Your board is empty</p>
          <p className="mt-1">
            Add words, quotes, or pictures that remind you where you&apos;re heading. Link a card to
            a goal to see it there too.
          </p>
        </div>
      ) : (
        <ul
          aria-label="Vision board"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
        >
          {cards.map((card, index) => {
            const goal = goals.find((g) => g.id === card.goal_id);
            const area = areas.find((a) => a.id === card.area_id);
            const label = card.title ?? card.body?.slice(0, 40) ?? "Image";
            return (
              <li
                key={card.id}
                draggable
                onDragStart={(e) => {
                  setDragged(card.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragged && dragged !== card.id) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragged && dragged !== card.id) {
                    const from = cards.findIndex((c) => c.id === dragged);
                    // Dropping on a later card places it after that card.
                    move(dragged, from < index ? (cards[index + 1]?.id ?? null) : card.id);
                  }
                  setDragged(null);
                }}
                onDragEnd={() => setDragged(null)}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface",
                  dragged === card.id && "opacity-50",
                )}
              >
                {card.image_path &&
                  (card.image_url ? (
                    // Signed URLs for a private bucket: next/image would need a remote pattern
                    // per project and caches by URL, so a plain img is used deliberately.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.image_url}
                      alt={card.image_alt ?? ""}
                      draggable={false}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-surface-muted text-xs text-muted-foreground">
                      Image unavailable
                    </div>
                  ))}
                <div className={cn("flex-1 space-y-1 p-3", !card.image_path && "py-6")}>
                  {card.title && (
                    <p
                      className={cn(
                        "font-medium break-words",
                        !card.image_path && "text-lg leading-snug",
                      )}
                    >
                      {card.title}
                    </p>
                  )}
                  {card.body && (
                    <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
                      {card.body}
                    </p>
                  )}
                  {(goal || area) && (
                    <p className="text-xs text-muted-foreground">
                      {[goal && `Goal: ${goal.name}`, area?.name].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-end gap-0.5 border-t border-border px-1.5 py-1 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <IconButton
                    label={`Move “${label}” earlier`}
                    disabled={busy || index === 0}
                    onClick={() => move(card.id, cards[index - 1]!.id)}
                  >
                    <ArrowLeft aria-hidden className="size-3.5" />
                  </IconButton>
                  <IconButton
                    label={`Move “${label}” later`}
                    disabled={busy || index === cards.length - 1}
                    onClick={() => move(card.id, cards[index + 2]?.id ?? null)}
                  >
                    <ArrowRight aria-hidden className="size-3.5" />
                  </IconButton>
                  <IconButton
                    label={`Edit “${label}”`}
                    disabled={busy}
                    onClick={() => setEditing(card)}
                  >
                    <Pencil aria-hidden className="size-3.5" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CardPanel card={editing} areas={areas} goals={goals} onClose={() => setEditing(null)} />
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}
