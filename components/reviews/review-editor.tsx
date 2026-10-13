"use client";

import { InlineEdit } from "@/components/ui/inline-edit";
import { saveReviewField } from "@/features/reviews/actions";
import { REVIEW_FIELDS, REVIEW_PROMPTS } from "@/features/reviews/logic";
import type { ReviewText } from "@/features/reviews/queries";

/** The four reflection prompts, each click-to-edit and saved on its own (honest Saving/Saved). */
export function ReviewEditor({ weekStart, text }: { weekStart: string; text: ReviewText }) {
  return (
    <div className="space-y-4">
      {REVIEW_FIELDS.map((field) => (
        <InlineEdit
          // Re-mount per week so navigating weeks reseeds the field from the new value.
          key={`${weekStart}:${field}`}
          value={text[field]}
          label={REVIEW_PROMPTS[field].label}
          placeholder={REVIEW_PROMPTS[field].placeholder}
          multiline
          maxLength={5000}
          onSave={async (value) => {
            const result = await saveReviewField(weekStart, field, value);
            return result.ok ? null : result.error;
          }}
        />
      ))}
    </div>
  );
}
