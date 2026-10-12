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
  /** False until the module's implementation phase ships; rendered as disabled. */
  available: boolean;
};

export const primaryNavigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, available: true },
  { label: "Inbox", href: "/inbox", icon: Inbox, available: true },
  { label: "Today", href: "/today", icon: Sun, available: true },
  { label: "Planner", href: "/planner", icon: CalendarDays, available: true },
  { label: "Tasks", href: "/tasks", icon: CheckSquare, available: true },
  { label: "Projects", href: "/projects", icon: FolderKanban, available: true },
  { label: "Habits", href: "/habits", icon: Repeat, available: false },
  { label: "Goals & Vision", href: "/goals", icon: Star, available: false },
  { label: "Notes", href: "/notes", icon: NotebookPen, available: false },
  { label: "Journal", href: "/journal", icon: BookOpen, available: false },
  { label: "Reviews", href: "/reviews", icon: TrendingUp, available: false },
  { label: "Settings", href: "/settings", icon: Settings, available: true },
];
