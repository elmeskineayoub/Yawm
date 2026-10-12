"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setReminderPreferences } from "@/features/reminders/actions";
import {
  REMINDER_CATEGORY_LABELS,
  type ReminderCategory,
  type ReminderPrefs,
} from "@/features/reminders/logic";

const CATEGORIES: ReminderCategory[] = ["task", "habit", "time_block"];

export function ReminderSettings({ initial }: { initial: ReminderPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [, startTransition] = useTransition();

  const toggle = (category: ReminderCategory) => {
    const next = { ...prefs, [category]: !prefs[category] };
    setPrefs(next);
    startTransition(async () => {
      const result = await setReminderPreferences(next);
      if (!result.ok) {
        toast.error(result.error);
        setPrefs((p) => ({ ...p, [category]: !p[category] }));
      }
    });
  };

  return (
    <fieldset className="mt-4 space-y-2">
      <legend className="sr-only">Reminder categories</legend>
      {CATEGORIES.map((category) => (
        <label key={category} className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={prefs[category]}
            onChange={() => toggle(category)}
            className="size-4 rounded border-border"
          />
          {REMINDER_CATEGORY_LABELS[category]}
        </label>
      ))}
    </fieldset>
  );
}
