"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";

const subscribe = () => () => {};
type ThemeValue = "light" | "dark" | "system";

/** Compact Light / Dark / System switch for the account area. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored theme is unknown during server rendering; render the control only once mounted.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!mounted) return <div aria-hidden className="h-8" />;
  const value: ThemeValue = theme === "light" || theme === "dark" ? theme : "system";
  const icon = (Icon: typeof Sun, label: string) => (
    <>
      <Icon aria-hidden className="size-3.5" />
      <span className="sr-only">{label}</span>
    </>
  );
  return (
    <SegmentedControl<ThemeValue>
      label="Theme"
      size="sm"
      value={value}
      onChange={setTheme}
      items={[
        { value: "light", label: icon(Sun, "Light theme"), title: "Light" },
        { value: "dark", label: icon(Moon, "Dark theme"), title: "Dark" },
        { value: "system", label: icon(Monitor, "System theme"), title: "Match system" },
      ]}
    />
  );
}
