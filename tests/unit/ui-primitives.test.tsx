import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/field";
import { LinkTabs } from "@/components/ui/link-tabs";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetHeader } from "@/components/ui/sheet";

describe("SegmentedControl", () => {
  it("as buttons: a named group with one pressed item, switching on click", async () => {
    function Harness() {
      const [value, setValue] = useState<"grid" | "agenda">("grid");
      return (
        <SegmentedControl
          label="Calendar display"
          value={value}
          onChange={setValue}
          items={[
            { value: "grid", label: "Timeline" },
            { value: "agenda", label: "Agenda" },
          ]}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Calendar display" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timeline" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Timeline" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("as links: a named nav marking the current item", () => {
    render(
      <SegmentedControl
        label="View"
        value="list"
        items={[
          { value: "list", label: "List", href: "/tasks" },
          { value: "board", label: "Board", href: "/tasks?view=board" },
        ]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Board" })).not.toHaveAttribute("aria-current");
  });
});

describe("LinkTabs", () => {
  it("marks the current tab", () => {
    render(
      <LinkTabs
        label="Idea status"
        current="someday"
        tabs={[
          { key: "inbox", href: "/inbox", label: "Inbox" },
          { key: "someday", href: "/inbox?status=someday", label: "Someday", count: 3 },
        ]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Idea status" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Someday/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Inbox" })).not.toHaveAttribute("aria-current");
  });
});

describe("InputField", () => {
  it("keeps the label paired with a caller-supplied id", () => {
    render(<InputField label="Email" name="email" id="login-email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "login-email");
  });

  it("announces errors through aria-describedby", () => {
    render(<InputField label="Title" name="title" errors={["Title is required."]} />);
    const input = screen.getByLabelText("Title");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Title is required.");
  });
});

describe("Sheet", () => {
  it("is a named dialog that closes from its close button", async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetHeader title="Edit time block" description="Scheduled time to work." />
        </Sheet>
      );
    }
    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "Edit time block" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Menu", () => {
  it("opens from the keyboard and exposes menu items", async () => {
    render(
      <Menu>
        <MenuTrigger asChild>
          <Button>Convert</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem>To a task</MenuItem>
          <MenuItem tone="danger">Delete</MenuItem>
        </MenuContent>
      </Menu>,
    );
    screen.getByRole("button", { name: "Convert" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "To a task" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });
});

describe("Section and PageHeader", () => {
  it("labels a section by its heading", () => {
    render(
      <Section title="Overdue" count={3} tone="danger">
        <p>rows</p>
      </Section>,
    );
    expect(screen.getByRole("region", { name: "Overdue 3" })).toBeInTheDocument();
  });

  it("renders the title as the page heading with a breadcrumb", () => {
    render(
      <PageHeader title="Write first issue" breadcrumb={[{ label: "Tasks", href: "/tasks" }]} />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Write first issue" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute("href", "/tasks");
  });
});
