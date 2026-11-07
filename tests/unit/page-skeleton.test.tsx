import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageSkeleton } from "@/components/ui/page-skeleton";

describe("PageSkeleton", () => {
  it.each(["list", "split", "sections", "grid", "timer"] as const)(
    "%s: one labelled, busy status region with decorative blocks only",
    (shape) => {
      const { container } = render(<PageSkeleton shape={shape} label="Loading tasks" />);
      const status = screen.getByRole("status", { name: "Loading tasks" });
      expect(status.getAttribute("aria-busy")).toBe("true");
      expect(screen.getAllByRole("status")).toHaveLength(1);
      // Every placeholder block is hidden from assistive technology.
      const blocks = container.querySelectorAll(".animate-pulse");
      expect(blocks.length).toBeGreaterThan(3);
      blocks.forEach((b) => expect(b.getAttribute("aria-hidden")).toBe("true"));
    },
  );
});
