import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { primaryNavigation } from "@/lib/navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

describe("SidebarNav", () => {
  it("marks the current page and links available modules", () => {
    render(<SidebarNav collapsed={false} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    for (const name of ["Inbox", "Today", "Planner", "Tasks", "Projects", "Notes", "Journal"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
  });

  it("renders every available module as a link, and disabled ones as non-links", () => {
    render(<SidebarNav collapsed={false} />);
    for (const item of primaryNavigation) {
      if (item.available) {
        expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
      } else {
        expect(screen.queryByRole("link", { name: item.label })).not.toBeInTheDocument();
        expect(screen.getByText(item.label).closest("[aria-disabled]")).toHaveAttribute(
          "aria-disabled",
          "true",
        );
      }
    }
    // Reviews shipped in Phase 5.
    expect(screen.getByRole("link", { name: "Reviews" })).toBeInTheDocument();
  });

  it("keeps labels available to screen readers when collapsed", () => {
    render(<SidebarNav collapsed />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });
});
