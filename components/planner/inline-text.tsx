"use client";

import { InlineEdit, type InlineEditProps } from "@/components/ui/inline-edit";
import { savePlanField } from "@/features/planning/actions";

/** A plan's theme, focus, or reflection, edited in place. */
export function InlineText({
  period,
  start,
  field,
  ...props
}: Omit<InlineEditProps, "onSave"> & {
  period: string;
  start: string;
  field: "theme" | "focus" | "reflection";
}) {
  return (
    <InlineEdit
      {...props}
      onSave={async (value) => {
        const result = await savePlanField(period, start, field, value);
        return result.ok ? null : result.error;
      }}
    />
  );
}
