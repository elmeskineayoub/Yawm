import { z } from "zod";

/**
 * Dashboard sections (REQUIREMENTS 6.1), in their fixed, sensible order. Each can be hidden; the
 * choice is stored on the user's profile (profiles.dashboard_prefs) so it follows them.
 */
export const DASHBOARD_SECTIONS = [
  {
    key: "attention",
    label: "Needs attention",
    description: "Overdue work, milestones due soon, ideas to sort.",
  },
  {
    key: "today",
    label: "Today at a glance",
    description: "Due, scheduled, habits, and focus for today.",
  },
  { key: "week", label: "This week", description: "Theme, completion, habit rate, focus time." },
  {
    key: "progress",
    label: "Projects & goals",
    description: "Active projects and goals with progress.",
  },
  { key: "reflect", label: "Reflect", description: "Today's journal prompt." },
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number]["key"];
const KEYS = DASHBOARD_SECTIONS.map((s) => s.key) as [DashboardSection, ...DashboardSection[]];

export const dashboardPrefsSchema = z.object({
  hidden: z.array(z.enum(KEYS)).max(KEYS.length),
});
export type DashboardPrefs = z.infer<typeof dashboardPrefsSchema>;

/**
 * Reads the stored preference. It is JSON from the database, so anything unexpected (unknown keys,
 * a wrong shape) is ignored rather than trusted: at worst every section shows.
 */
export function parseDashboardPrefs(value: unknown): Set<DashboardSection> {
  if (typeof value !== "object" || value === null || !("hidden" in value)) return new Set();
  const hidden = (value as { hidden: unknown }).hidden;
  if (!Array.isArray(hidden)) return new Set();
  return new Set(
    hidden.filter((k): k is DashboardSection => (KEYS as readonly unknown[]).includes(k)),
  );
}

/** The stored form: known keys only, de-duplicated, in section order. */
export function serializeHidden(hidden: Iterable<DashboardSection>): DashboardPrefs {
  const set = new Set(hidden);
  return { hidden: KEYS.filter((k) => set.has(k)) };
}
