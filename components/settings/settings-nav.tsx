"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SettingsSection = { id: string; label: string };

/**
 * Jump links for the Settings sections: a sticky list beside the page on wide screens and a
 * scrollable row on phones. The section in view is marked (aria-current) as you scroll.
 */
export function SettingsNav({ sections }: { sections: SettingsSection[] }) {
  const [current, setCurrent] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    // Without IntersectionObserver the links still work; only the highlight stays put.
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        // The topmost section that is on screen wins.
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setCurrent(top[0]);
      },
      { rootMargin: "-15% 0px -60% 0px" },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    // The observer's first report covers arriving with a hash (e.g. #google after connecting).
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Settings sections">
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-0">
        {sections.map((s) => {
          const active = s.id === current;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={active ? "location" : undefined}
                onClick={() => setCurrent(s.id)}
                className={cn(
                  "block rounded-full border px-3 py-1 text-[0.8125rem] whitespace-nowrap transition-colors lg:rounded-md lg:border-0 lg:px-2.5 lg:py-1.5 lg:text-sm",
                  active
                    ? "border-accent/40 bg-accent-soft text-accent lg:font-medium"
                    : "border-border text-muted-foreground hover:text-foreground lg:hover:bg-surface-muted",
                )}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
