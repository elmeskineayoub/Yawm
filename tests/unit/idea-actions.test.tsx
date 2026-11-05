import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdeaActions } from "@/components/inbox/idea-actions";

const actions = vi.hoisted(() => ({
  convertIdea: vi.fn(),
  deleteIdea: vi.fn(),
  setIdeaStatus: vi.fn(),
}));
vi.mock("@/features/inbox/actions", () => actions);
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const idea = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Start a podcast",
  status: "inbox" as const,
  converted_task_id: null,
  converted_project_id: null,
  converted_goal_id: null,
};

describe("Idea actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.setIdeaStatus.mockResolvedValue({ ok: true, data: undefined });
    actions.deleteIdea.mockResolvedValue({ ok: true, data: undefined });
    actions.convertIdea.mockResolvedValue({ ok: true, data: { href: "/projects/p1" } });
  });

  it("archives in one click and can be undone from the toast", async () => {
    render(<IdeaActions idea={idea} />);
    await userEvent.click(screen.getByRole("button", { name: "Archive “Start a podcast”" }));
    expect(actions.setIdeaStatus).toHaveBeenCalledWith(idea.id, "archived");
    const [message, options] = toast.success.mock.calls[0]!;
    expect(message).toBe("Idea archived");
    await options.action.onClick();
    expect(actions.setIdeaStatus).toHaveBeenLastCalledWith(idea.id, "inbox");
  });

  it("converts from one menu and opens the result", async () => {
    render(<IdeaActions idea={idea} />);
    await userEvent.click(screen.getByRole("button", { name: "Convert “Start a podcast”" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Convert “Start a podcast” to a project" }),
    );
    expect(actions.convertIdea).toHaveBeenCalledWith(idea.id, "project");
    expect(push).toHaveBeenCalledWith("/projects/p1");
  });

  it("offers to open what an idea was already converted into", async () => {
    render(<IdeaActions idea={{ ...idea, status: "archived", converted_task_id: "t1" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Convert “Start a podcast”" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Open task" }));
    expect(push).toHaveBeenCalledWith("/tasks/t1");
    expect(actions.convertIdea).not.toHaveBeenCalled();
    // An archived idea restores instead of archiving again.
    expect(
      screen.getByRole("button", { name: "Restore “Start a podcast” to the Inbox" }),
    ).toBeTruthy();
  });

  it("deletes only after confirming, from the More menu", async () => {
    render(<IdeaActions idea={idea} />);
    await userEvent.click(
      screen.getByRole("button", { name: "More actions for “Start a podcast”" }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    expect(actions.deleteIdea).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", { name: "Delete this idea?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(actions.deleteIdea).toHaveBeenCalledWith(idea.id);
  });

  it("reports a lost connection on archive instead of crashing", async () => {
    actions.setIdeaStatus.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<IdeaActions idea={idea} />);
    await userEvent.click(screen.getByRole("button", { name: "Archive “Start a podcast”" }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/wasn't saved|offline/));
  });
});
