import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationProgress } from "@/components/layout/navigation-progress";

const nav = vi.hoisted(() => ({ pathname: "/planner", search: "view=week" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

// next/link calls preventDefault() in its own click handler to take over navigation; mimic that.
function LinkLike({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} onClick={(e) => e.preventDefault()}>
      {children}
    </a>
  );
}

describe("NavigationProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    nav.pathname = "/planner";
    nav.search = "view=week";
    window.history.replaceState(null, "", "/planner?view=week");
  });
  afterEach(() => vi.useRealTimers());

  it("shows for a slow in-page navigation even though the link prevents default, then clears", () => {
    const { rerender } = render(
      <>
        <NavigationProgress />
        <LinkLike href="/planner?view=week&start=2026-11-06">Next week</LinkLike>
      </>,
    );
    fireEvent.click(screen.getByText("Next week"));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(); // not for fast ones
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("progressbar", { name: "Loading page" })).toBeInTheDocument();

    // The URL changes when the navigation commits.
    nav.search = "view=week&start=2026-11-06";
    rerender(
      <>
        <NavigationProgress />
        <LinkLike href="/planner?view=week&start=2026-11-06">Next week</LinkLike>
      </>,
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("ignores links to the current page, new-tab clicks, and other origins", () => {
    render(
      <>
        <NavigationProgress />
        <LinkLike href="/planner?view=week">Same page</LinkLike>
        <LinkLike href="https://example.com/">Elsewhere</LinkLike>
        <LinkLike href="/tasks">Tasks</LinkLike>
      </>,
    );
    fireEvent.click(screen.getByText("Same page"));
    fireEvent.click(screen.getByText("Elsewhere"));
    fireEvent.click(screen.getByText("Tasks"), { metaKey: true });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("gives up rather than sticking if the navigation never completes", () => {
    render(
      <>
        <NavigationProgress />
        <LinkLike href="/tasks">Tasks</LinkLike>
      </>,
    );
    fireEvent.click(screen.getByText("Tasks"));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
