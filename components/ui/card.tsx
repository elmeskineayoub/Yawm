import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The one card surface: hairline border, card radius, card padding (16px phone, 24px desktop). */
export const cardClass = "rounded-card border border-border bg-surface p-card-sm sm:p-card";

/**
 * The base card: a titled block of related content. Every card on a page uses this, so padding,
 * radius, and heading style never drift. The title is an h3 (cards sit inside a page section whose
 * heading is the h2); pass `headingLevel="h2"` for a card that is its own section.
 */
export function Card({
  title,
  count,
  actions,
  tone,
  headingLevel: Heading = "h3",
  className,
  children,
}: {
  title: ReactNode;
  /** Shown after the title in muted text, e.g. "2/5". */
  count?: number | string;
  /** Right side of the header: one or two links. */
  actions?: ReactNode;
  /** Colours the title, e.g. for overdue work. */
  tone?: "danger";
  headingLevel?: "h2" | "h3";
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn(cardClass, "min-w-0", className)}>
      <div className="mb-3 flex min-h-6 items-center justify-between gap-3">
        <Heading
          id={id}
          className={cn("min-w-0 text-sm font-semibold", tone === "danger" && "text-danger")}
        >
          {title}
          {count !== undefined && " "}
          {count !== undefined && (
            <span
              className={cn(
                "font-normal tabular-nums",
                tone === "danger" ? "text-danger" : "text-muted-foreground",
              )}
            >
              {count}
            </span>
          )}
        </Heading>
        {actions && (
          <div className="flex shrink-0 items-center gap-4 text-sm whitespace-nowrap">
            {actions}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * A page section: an h2 and the cards under it. Sections are separated by the section spacing
 * token on the page (48px phone, 64px desktop), so each reads as its own band.
 */
export function PageSection({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="text-h2 font-semibold">
          {title}
        </h2>
        {actions && (
          <div className="flex shrink-0 items-center gap-4 text-sm whitespace-nowrap">
            {actions}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
