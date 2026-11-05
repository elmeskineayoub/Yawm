import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearchProvider, SearchButton } from "@/components/layout/global-search";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SearchResponse } from "@/features/search/logic";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const response: SearchResponse = {
  query: "plan",
  groups: [
    {
      type: "task",
      more: true,
      results: [
        {
          type: "task",
          id: "t1",
          title: "Plan the week",
          href: "/tasks/t1",
          snippet: null,
          meta: "To do",
        },
        {
          type: "task",
          id: "t2",
          title: "Review plan",
          href: "/tasks/t2",
          snippet: null,
          meta: null,
        },
      ],
    },
    {
      type: "journal",
      more: false,
      results: [
        {
          type: "journal",
          id: "j1",
          title: "Nov 5",
          href: "/journal/j1",
          snippet: "… made a plan for …",
          meta: null,
        },
      ],
    },
  ],
};

function setup() {
  return render(
    <TooltipProvider>
      <GlobalSearchProvider>
        <SearchButton />
      </GlobalSearchProvider>
    </TooltipProvider>,
  );
}

describe("Global search", () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(response)),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens with /, debounces, and lists grouped results as options", async () => {
    setup();
    await userEvent.keyboard("/");
    const box = await screen.findByRole("combobox", { name: "Search everything" });
    await userEvent.type(box, "plan");
    expect(await screen.findByRole("option", { name: /Plan the week/ })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1); // one request for the whole word, not per keystroke
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toBe("/api/search?q=plan");
    expect(screen.getByRole("group", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Journal" })).toBeInTheDocument();
    // "See all" for a type with more results and its own search page.
    expect(screen.getByRole("option", { name: "See all in Tasks" })).toHaveAttribute(
      "href",
      "/tasks?q=plan&status=all",
    );
  });

  it("moves through results with the arrow keys and opens the active one with Enter", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    const box = await screen.findByRole("combobox");
    await userEvent.type(box, "plan");
    await screen.findByRole("option", { name: /Plan the week/ });
    expect(screen.getByRole("option", { name: /Plan the week/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{ArrowDown}");
    const second = screen.getByRole("option", { name: /Review plan/ });
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(box).toHaveAttribute("aria-activedescendant", second.id);
    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/tasks/t2");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not search one-character queries and shows errors honestly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "Searching too quickly. Try again in a moment." }, { status: 429 }),
      ),
    );
    setup();
    await userEvent.keyboard("/");
    const box = await screen.findByRole("combobox");
    await userEvent.type(box, "p");
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.type(box, "l");
    expect(await screen.findByRole("alert")).toHaveTextContent("Searching too quickly");
  });
});
