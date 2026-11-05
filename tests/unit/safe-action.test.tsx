import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskCheckbox } from "@/components/tasks/task-checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ok } from "@/lib/action-result";
import { safeAction } from "@/lib/safe-action";

const setTaskStatus = vi.hoisted(() => vi.fn());
vi.mock("@/features/tasks/actions", () => ({ setTaskStatus }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

describe("safeAction", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passes server results through untouched", async () => {
    expect(await safeAction(async () => ok(5))).toEqual({ ok: true, data: 5 });
    expect(await safeAction(async () => ({ ok: false as const, error: "Nope" }))).toEqual({
      ok: false,
      error: "Nope",
    });
  });

  it("turns a request that never reached the server into a failed result", async () => {
    const result = await safeAction(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Couldn't reach the server, so this wasn't saved/);
  });

  it("says so when the browser is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const result = await safeAction(() => Promise.reject(new TypeError("Failed to fetch")));
    if (!result.ok) expect(result.error).toMatch(/You're offline/);
  });
});

describe("a dropped connection never crashes the page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("task checkbox rolls back and explains instead of throwing", async () => {
    setTaskStatus.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<TaskCheckbox taskId="t1" title="Ship" status="todo" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete “Ship”" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String(toast.error.mock.calls[0]![0])).toMatch(/wasn't saved/);
    expect(screen.getByRole("checkbox", { name: "Complete “Ship”" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("confirm dialog stays open with a message instead of throwing", async () => {
    render(
      <ConfirmDialog
        trigger={<button type="button">Delete</button>}
        title="Delete this?"
        description="Gone for good."
        confirmLabel="Delete it"
        onConfirm={() => Promise.reject(new TypeError("Failed to fetch"))}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/nothing was changed/);
    expect(screen.getByRole("dialog", { name: "Delete this?" })).toBeInTheDocument();
  });
});
