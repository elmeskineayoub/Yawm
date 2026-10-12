"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { InputField, TextAreaField } from "@/components/ui/field";
import { SaveStatus } from "@/components/ui/save-status";
import { savePlan } from "@/features/planning/actions";
import { idleSaveState } from "@/lib/action-result";
import type { PlanPeriod } from "@/lib/dates";

const PROMPTS: Record<PlanPeriod, { theme: string; focus: string; reflection: string }> = {
  year: {
    theme: "Theme for the year",
    focus: "Outcomes, key goals, and which life areas to emphasise",
    reflection: "Year in review",
  },
  month: {
    theme: "Theme for the month",
    focus: "Goals and milestones to advance, projects to prioritise",
    reflection: "Month in review",
  },
  week: {
    theme: "Theme for the week",
    focus: "Focus outcomes and top priorities",
    reflection: "Week in review: what got done, what carries over",
  },
  day: {
    theme: "Intention for the day",
    focus: "What matters most today",
    reflection: "How did the day go?",
  },
};

export function PlanForm({
  period,
  start,
  plan,
}: {
  period: PlanPeriod;
  start: string;
  plan: { theme: string | null; focus: string | null; reflection: string | null } | null;
}) {
  const [state, action, pending] = useActionState(
    savePlan.bind(null, period, start),
    idleSaveState,
  );
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const prompts = PROMPTS[period];

  return (
    // Keyed by period so switching periods resets the uncontrolled fields.
    <form key={`${period}-${start}`} action={action} className="space-y-4" noValidate>
      <InputField
        label={prompts.theme}
        name="theme"
        maxLength={200}
        defaultValue={plan?.theme ?? ""}
        errors={errors?.theme}
      />
      <TextAreaField
        label={prompts.focus}
        name="focus"
        rows={4}
        maxLength={5000}
        defaultValue={plan?.focus ?? ""}
        errors={errors?.focus}
      />
      <TextAreaField
        label={prompts.reflection}
        name="reflection"
        rows={3}
        maxLength={10000}
        defaultValue={plan?.reflection ?? ""}
        errors={errors?.reflection}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {plan ? "Save plan" : "Create plan"}
        </Button>
        <SaveStatus pending={pending} state={state} />
      </div>
    </form>
  );
}
