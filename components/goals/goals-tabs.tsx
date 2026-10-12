import Link from "next/link";
import { cn } from "@/lib/utils";

/** Switches between the goal list and the vision board, which share one navigation entry. */
export function GoalsTabs({ current }: { current: "goals" | "vision" }) {
  const tabs = [
    { key: "goals", href: "/goals", label: "Goals" },
    { key: "vision", href: "/goals/vision", label: "Vision board" },
  ] as const;
  return (
    <nav aria-label="Goals and vision" className="mb-6 flex gap-1 border-b border-border text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2",
            current === tab.key
              ? "border-accent font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
