"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { carryForward } from "@/features/planning/actions";
import { plannerHref } from "@/features/planning/view";

/** Explicit "carry forward": links unfinished priorities to the next period. Deadlines stay. */
export function CarryForwardButton({
  period,
  start,
  openCount,
  nextLabel,
}: {
  period: "day" | "week" | "month";
  start: string;
  openCount: number;
  nextLabel: string;
}) {
  const router = useRouter();
  if (openCount === 0) return null;
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" className="px-2 py-1 text-xs">
          Carry {openCount} unfinished to {nextLabel}
          <ArrowRight aria-hidden className="size-3.5" />
        </Button>
      }
      title={`Carry unfinished priorities to ${nextLabel}?`}
      description={
        <p>
          {openCount} unfinished {openCount === 1 ? "task is" : "tasks are"} added to {nextLabel}
          &apos;s priorities. They stay listed here too, and their deadlines don&apos;t change.
        </p>
      }
      confirmLabel="Carry forward"
      destructive={false}
      onConfirm={async () => {
        const result = await carryForward(period, start);
        if (!result.ok) return result.error;
        toast.success(
          result.data.moved === 0
            ? `Already planned for ${nextLabel}`
            : `Carried ${result.data.moved} to ${nextLabel}`,
          {
            action: {
              label: "Open",
              onClick: () =>
                router.push(plannerHref(result.data.next.period, result.data.next.start)),
            },
          },
        );
        return null;
      }}
    />
  );
}
