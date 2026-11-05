import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { navigationGroups, primaryNavigation } from "@/lib/navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

// The app wraps everything in one TooltipProvider (app/providers.tsx); rail items use tooltips.
const renderNav = (ui: ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("SidebarNav", () => {
  it("marks the current page and links every destination", () => {
    renderNav(<SidebarNav collapsed={false} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    for (const item of primaryNavigation) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
  });

  it("has exactly the twelve primary destinations from the requirements", () => {
    expect(primaryNavigation.map((i) => i.label)).toEqual([
      "Dashboard",
      "Today",
      "Inbox",
      "Tasks",
      "Planner",
      "Projects",
      "Goals & Vision",
      "Habits",
      "Notes",
      "Journal",
      "Reviews",
      "Settings",
    ]);
    expect(navigationGroups.map((g) => g.label)).toEqual([null, "Execute", "Organise", "Reflect"]);
  });

  it("shows group labels in the drawer", () => {
    renderNav(<SidebarNav collapsed={false} variant="drawer" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const label of ["Execute", "Organise", "Reflect"]) {
      expect(within(nav).getByText(label)).toBeVisible();
    }
  });

  it("keeps labels available to screen readers when collapsed", () => {
    renderNav(<SidebarNav collapsed />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("announces the inbox count with the Inbox link", () => {
    renderNav(<SidebarNav collapsed={false} variant="drawer" inboxCount={4} />);
    expect(screen.getByRole("link", { name: "Inbox, 4 to triage" })).toHaveAttribute(
      "href",
      "/inbox",
    );
  });
});
