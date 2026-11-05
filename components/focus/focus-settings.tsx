"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import type { FocusConfig } from "@/features/focus/logic";
import { cn } from "@/lib/utils";

/** Pomodoro durations (kept in this browser). An unstarted phase adopts new lengths at once. */
export function FocusSettings({
  config,
  onSave,
}: {
  config: FocusConfig;
  onSave: (config: FocusConfig) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(config);
  const inputs: { key: keyof FocusConfig; label: string; min: number; max: number }[] = [
    { key: "focusMinutes", label: "Focus (min)", min: 1, max: 180 },
    { key: "shortBreakMinutes", label: "Short break (min)", min: 1, max: 60 },
    { key: "longBreakMinutes", label: "Long break (min)", min: 1, max: 120 },
    { key: "longBreakEvery", label: "Long break every", min: 2, max: 12 },
  ];
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {inputs.map(({ key, label, min, max }) => (
          <div key={key} className="space-y-1">
            <label
              htmlFor={`${id}-${key}`}
              className="block text-xs font-medium text-muted-foreground"
            >
              {label}
            </label>
            <input
              id={`${id}-${key}`}
              type="number"
              min={min}
              max={max}
              value={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
              className={cn(controlClass, "py-1.5")}
            />
          </div>
        ))}
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Save durations
      </Button>
    </form>
  );
}
