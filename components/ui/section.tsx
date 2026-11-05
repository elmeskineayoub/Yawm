import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * An unboxed page section: heading, optional count and actions, then content. Hierarchy comes
 * from type and spacing rather than a bordered card (docs/UX_REDESIGN.md §5).
 */
export function Section({
  title,
  count,
  actions,
  description,
  variant = "default",
  tone,
  divider = false,
  className,
  children,
}: {
  title: ReactNode;
  count?: number | string;
  actions?: ReactNode;
  description?: ReactNode;
  /** "label" renders the small letter-spaced editorial label instead of a text heading. */
  variant?: "default" | "label";
  /** Colours the heading, e.g. for an Overdue section. */
  tone?: "danger";
  /** Hairline rule above the section. */
  divider?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(divider && "border-t border-border pt-6", className)}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2
          id={id}
          className={cn(
            "min-w-0",
            variant === "label" ? "label-caps" : "text-sm font-semibold",
            tone === "danger" && "text-danger",
          )}
        >
          {title}
          {/* A real space (not just margin) so the accessible name reads "Overdue 3". */}
          {count !== undefined && " "}
          {count !== undefined && (
            <span
              className={cn(
                "ml-0.5 font-normal tabular-nums",
                tone === "danger" ? "text-danger" : "text-muted-foreground",
              )}
            >
              {count}
            </span>
          )}
        </h2>
        {actions && (
          <div className="flex shrink-0 items-center gap-3 text-sm whitespace-nowrap">
            {actions}
          </div>
        )}
      </div>
      {description && <p className="-mt-1 mb-2 text-xs text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}
