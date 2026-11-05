import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FocusWorkspace } from "@/components/focus/focus-workspace";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FOCUS_PENDING_STORAGE_KEY, FOCUS_TIMER_STORAGE_KEY } from "@/features/focus/logic";

const logFocusSession = vi.hoisted(() => vi.fn());
vi.mock("@/features/focus/actions", () => ({ logFocusSession, deleteFocusSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const projects = [
  { id: A, name: "Newsletter", color: null },
  { id: B, name: "Garden", color: null },
];
const tasks = [
  { id: "11111111-1111-4111-8111-111111111111", title: "Write issue", project_id: A },
  { id: "22222222-2222-4222-8222-222222222222", title: "Plant beds", project_id: B },
  { id: "33333333-3333-4333-8333-333333333333", title: "Read book", project_id: null },
];

let clock = Date.parse("2026-11-05T09:00:00Z");
function setup() {
  return render(
    <TooltipProvider>
      <FocusWorkspace
        projects={projects}
        tasks={tasks}
        totals={{ [A]: { todaySeconds: 1500, weekSeconds: 3000, totalSeconds: 9000 } }}
        projectTrackingAvailable
        today={{ seconds: 1500, sessions: 1 }}
        weekSeconds={3000}
        recent={[]}
        sessionProjects={{}}
        timezone="UTC"
        initialProjectId={null}
      />
    </TooltipProvider>,
  );
}
const pickProject = async (name: string) => {
  await userEvent.click(screen.getByRole("button", { name: /^Project/ }));
  await userEvent.click(await screen.findByRole("option", { name }));
};
const taskSelect = () => screen.getByLabelText("Task (optional)");

describe("Focus workspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    clock = Date.parse("2026-11-05T09:00:00Z");
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    logFocusSession.mockResolvedValue({ ok: true, data: { id: "x", projectSaved: true } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows only the chosen project's tasks, and its tracked time", async () => {
    setup();
    await pickProject("Newsletter");
    const options = within(taskSelect())
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["No specific task", "Write issue"]);
    const context = screen.getByRole("region", { name: /Counts toward/ });
    expect(context).toHaveTextContent("Newsletter");
    expect(context).toHaveTextContent("25m"); // today
    expect(context).toHaveTextContent("2h 30m"); // total
  });

  it("a task brings its project; general focus is a real choice", async () => {
    setup();
    expect(screen.getByRole("region", { name: /Counts toward/ })).toHaveTextContent(
      "General focus",
    );
    await userEvent.selectOptions(taskSelect(), "Plant beds");
    expect(screen.getByRole("button", { name: /^Project/ })).toHaveTextContent("Garden");
  });

  it("locks project and task while a session runs", async () => {
    setup();
    await pickProject("Newsletter");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByRole("button", { name: /^Project/ })).toBeDisabled();
    expect(taskSelect()).toBeDisabled();
  });

  it("Finish saves the actual focused time to the project, not the planned length", async () => {
    setup();
    await pickProject("Newsletter");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    clock += 7 * 60_000; // 7 minutes running
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    clock += 10 * 60_000; // paused for 10 minutes: not counted
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    clock += 5 * 60_000; // 5 more minutes
    await userEvent.click(screen.getByRole("button", { name: "Finish session" }));
    expect(logFocusSession).toHaveBeenCalledTimes(1);
    expect(logFocusSession.mock.calls[0]![0]).toMatchObject({
      project_id: A,
      session_type: "focus",
      duration_seconds: 12 * 60,
    });
  });

  it("Discard saves nothing", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    clock += 30_000;
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(logFocusSession).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("keeps a session that could not reach the server, and retries it with the same id", async () => {
    logFocusSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const first = setup();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    clock += 3 * 60_000;
    await userEvent.click(screen.getByRole("button", { name: "Finish session" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    const queued = JSON.parse(window.localStorage.getItem(FOCUS_PENDING_STORAGE_KEY)!);
    expect(queued).toHaveLength(1);
    const id = queued[0].id;
    first.unmount();
    setup(); // next visit
    await vi.waitFor(() => expect(logFocusSession).toHaveBeenCalledTimes(2));
    expect(logFocusSession.mock.calls[1]![0].id).toBe(id);
    await vi.waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem(FOCUS_PENDING_STORAGE_KEY)!)).toEqual([]),
    );
  });

  it("entering and leaving immersive mode never interrupts the timer", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    const before = JSON.parse(window.localStorage.getItem(FOCUS_TIMER_STORAGE_KEY)!);
    await userEvent.click(screen.getByRole("button", { name: "Enter immersive mode" }));
    const dialog = await screen.findByRole("dialog", { name: "Focus, immersive view" });
    expect(within(dialog).getByRole("button", { name: "Pause" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await act(async () => {});
    const after = JSON.parse(window.localStorage.getItem(FOCUS_TIMER_STORAGE_KEY)!);
    expect(after).toMatchObject({ id: before.id, running: true, startedAt: before.startedAt });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
