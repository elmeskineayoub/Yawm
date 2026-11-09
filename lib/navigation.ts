import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  NotebookPen,
  Repeat,
  Settings,
  Star,
  Sun,
  TrendingUp,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  /** Section label shown above the group; null for the ungrouped top and bottom items. */
  label: string | null;
  items: NavItem[];
};

const item = (label: string, href: string, icon: LucideIcon): NavItem => ({ label, href, icon });

/**
 * The twelve primary destinations (REQUIREMENTS.md §5), grouped along the
 * Capture → Clarify → Plan → Execute → Reflect loop. Settings sits apart at the bottom.
 */
export const navigationGroups: NavGroup[] = [
  { label: null, items: [item("Dashboard", "/dashboard", LayoutDashboard)] },
  {
    label: "Execute",
    items: [
      item("Today", "/today", Sun),
      item("Inbox", "/inbox", Inbox),
      item("Tasks", "/tasks", CheckSquare),
      item("Planner", "/planner", CalendarDays),
    ],
  },
  {
    label: "Organise",
    items: [
      item("Projects", "/projects", FolderKanban),
      item("Goals & Vision", "/goals", Star),
      item("Habits", "/habits", Repeat),
    ],
  },
  {
    label: "Reflect",
    items: [
      item("Notes", "/notes", NotebookPen),
      item("Journal", "/journal", BookOpen),
      item("Reviews", "/reviews", TrendingUp),
    ],
  },
];

export const settingsNavigation: NavItem = item("Settings", "/settings", Settings);

/** Every destination in display order (used by tests and anywhere a flat list is needed). */
export const primaryNavigation: NavItem[] = [
  ...navigationGroups.flatMap((group) => group.items),
  settingsNavigation,
];

/** Destinations in the mobile bottom bar, around the central Capture button. */
export const mobileTabs = {
  before: ["/today", "/planner"],
  after: ["/inbox"],
} as const;

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * How the desktop sidebar is laid out: "full" always labelled (the mobile menu), "rail" icons only
 * (collapsed by the user), "responsive" an icon rail below the lg breakpoint and labelled from lg.
 */
export type ShellLayout = "full" | "rail" | "responsive";

export type ContentWidth = "wide" | "standard" | "reading";

/**
 * How wide the main column may grow. The Planner needs the whole screen for its calendar; detail
 * pages (tasks, notes, journal entries, ideas) keep a comfortable reading measure.
 */
export function contentWidthFor(pathname: string): ContentWidth {
  if (isActivePath(pathname, "/planner")) return "wide";
  // Notes open in the same two panes as the index (the editor sets its own measure), so only
  // single-column detail pages narrow to a reading width.
  if (/^\/(journal|inbox|tasks)\/[^/]+$/.test(pathname)) return "reading";
  return "standard";
}
