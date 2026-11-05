import { LinkTabs } from "@/components/ui/link-tabs";

/** Switches between the goal list and the vision board, which share one navigation entry. */
export function GoalsTabs({ current }: { current: "goals" | "vision" }) {
  return (
    <LinkTabs
      label="Goals and vision"
      current={current}
      className="mb-6"
      tabs={[
        { key: "goals", href: "/goals", label: "Goals" },
        { key: "vision", href: "/goals/vision", label: "Vision board" },
      ]}
    />
  );
}
