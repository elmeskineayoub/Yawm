"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const subscribe = () => () => {};

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  // The stored theme is unknown during server rendering; avoid a mismatched selection.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <fieldset>
      <legend className="text-sm font-medium">Theme</legend>
      <div className="mt-2 inline-flex rounded-md border border-border p-1">
        {options.map(({ value, label, icon: Icon }) => {
          const selected = mounted && theme === value;
          return (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-sm has-focus-visible:outline-2 has-focus-visible:outline-accent",
                selected ? "bg-surface-muted font-medium" : "text-muted-foreground",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={selected}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-4" />
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
