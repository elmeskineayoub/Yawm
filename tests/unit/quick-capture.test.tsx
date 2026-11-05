import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickCaptureButton, QuickCaptureProvider } from "@/components/shared/quick-capture";

// The dialog's form calls server actions; they are never invoked in these tests.
vi.mock("@/features/inbox/actions", () => ({ createIdea: vi.fn() }));
vi.mock("@/features/tasks/actions", () => ({ createTask: vi.fn() }));

describe("Quick capture", () => {
  it("opens one shared dialog from any trigger", async () => {
    render(
      <QuickCaptureProvider>
        <QuickCaptureButton />
        <QuickCaptureButton variant="tab" />
      </QuickCaptureProvider>,
    );
    const [sidebar, tab] = screen.getAllByRole("button", { name: "Quick capture" });
    await userEvent.click(tab!);
    expect(screen.getAllByRole("dialog", { name: "Quick capture" })).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(sidebar!);
    expect(screen.getAllByRole("dialog", { name: "Quick capture" })).toHaveLength(1);
  });

  it("opens with q once, even with several triggers mounted, but not while typing", async () => {
    render(
      <QuickCaptureProvider>
        <input aria-label="Elsewhere" />
        <QuickCaptureButton />
        <QuickCaptureButton variant="tab" />
      </QuickCaptureProvider>,
    );
    await userEvent.click(screen.getByLabelText("Elsewhere"));
    await userEvent.keyboard("q");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    (document.activeElement as HTMLElement).blur();
    await userEvent.keyboard("q");
    expect(screen.getAllByRole("dialog", { name: "Quick capture" })).toHaveLength(1);
  });
});
