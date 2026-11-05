import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Long-form reading and writing: the serif at 17/28 with a ~68-character measure. Used for journal
 * entries, notes, and reflection text. Pass `as="div"` around a textarea, or style the textarea
 * itself with `proseClass`.
 */
export const proseClass =
  "font-serif text-prose text-foreground [font-optical-sizing:auto] max-w-[68ch] whitespace-pre-wrap break-words";

export function Prose({
  as: Tag = "div",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn(proseClass, className)}>{children}</Tag>;
}
