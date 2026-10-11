import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarNav } from "@/components/layout/sidebar-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

describe("SidebarNav", () => {
  it("marks the current page and links available modules", () => {
    render(<SidebarNav collapsed={false} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
  });

  it("does not link modules that are not implemented yet", () => {
    render(<SidebarNav collapsed={false} />);
    expect(screen.queryByRole("link", { name: /Tasks/ })).not.toBeInTheDocument();
    expect(screen.getByText("Tasks").closest("[aria-disabled]")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("keeps labels available to screen readers when collapsed", () => {
    render(<SidebarNav collapsed />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });
});
