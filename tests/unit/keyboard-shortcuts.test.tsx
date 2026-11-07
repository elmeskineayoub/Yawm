import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardShortcuts, ShortcutsButton } from "@/components/layout/keyboard-shortcuts";
import { isShortcutEvent, nextNavItem } from "@/lib/keyboard";

function List() {
  return (
    <main>
      <ul>
        {["Alpha", "Beta", "Gamma"].map((t) => (
          <li key={t}>
            <button type="button" aria-label={`Done ${t}`} />
            <a href={`#${t}`} data-nav-item>
              {t}
            </a>
          </li>
        ))}
      </ul>
      <input aria-label="Field" />
    </main>
  );
}

const press = (key: string, target: Element | Window = window) =>
  fireEvent.keyDown(target, { key, shiftKey: key === "?" });

describe("keyboard shortcuts", () => {
  beforeEach(() => {
    // jsdom has no layout; treat every element as visible.
    vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it("j and k move focus through list rows, staying at the ends", () => {
    render(
      <>
        <List />
        <KeyboardShortcuts />
      </>,
    );
    press("j");
    expect(document.activeElement?.textContent).toBe("Alpha");
    press("j", document.activeElement!);
    press("j", document.activeElement!);
    expect(document.activeElement?.textContent).toBe("Gamma");
    press("j", document.activeElement!);
    expect(document.activeElement?.textContent).toBe("Gamma");
    press("k", document.activeElement!);
    expect(document.activeElement?.textContent).toBe("Beta");
  });

  it("starts from the row that holds focus, e.g. its checkbox", () => {
    render(
      <>
        <List />
        <KeyboardShortcuts />
      </>,
    );
    const done = screen.getByRole("button", { name: "Done Beta" });
    done.focus();
    press("j", done);
    expect(document.activeElement?.textContent).toBe("Gamma");
  });

  it("does nothing while typing", () => {
    render(
      <>
        <List />
        <KeyboardShortcuts />
      </>,
    );
    const field = screen.getByRole("textbox", { name: "Field" });
    field.focus();
    press("j", field);
    press("?", field);
    expect(document.activeElement).toBe(field);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("? opens the help listing real shortcuts; the sidebar button opens it too", () => {
    render(
      <>
        <KeyboardShortcuts />
        <ShortcutsButton />
      </>,
    );
    press("?");
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog.textContent).toContain("Quick capture");
    expect(dialog.textContent).toContain("Previous or next period");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
  });
});

describe("shortcut helpers", () => {
  it("ignores modified keys and keys over an open dialog", () => {
    const plain = new KeyboardEvent("keydown", { key: "j" });
    expect(isShortcutEvent(plain)).toBe(true);
    expect(isShortcutEvent(new KeyboardEvent("keydown", { key: "j", ctrlKey: true }))).toBe(false);
    expect(isShortcutEvent(new KeyboardEvent("keydown", { key: "j", metaKey: true }))).toBe(false);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    expect(isShortcutEvent(plain)).toBe(false);
    dialog.remove();
  });

  it("with nothing focused, j picks the first row and k the last", () => {
    const items = ["a", "b", "c"].map((t) => {
      const el = document.createElement("a");
      el.textContent = t;
      return el;
    });
    expect(nextNavItem(items, null, 1)?.textContent).toBe("a");
    expect(nextNavItem(items, null, -1)?.textContent).toBe("c");
    expect(nextNavItem([], null, 1)).toBeNull();
  });
});
