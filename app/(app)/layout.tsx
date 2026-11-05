import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { countInbox } from "@/features/inbox/queries";
import type { Reminder } from "@/features/reminders/logic";
import { loadReminders } from "@/features/reminders/queries";
import { requireUser } from "@/lib/auth/session";
import { SETUP_PATH } from "@/lib/auth/routes";
import { getSupabasePublicConfig } from "@/lib/env";
import { isSidebarCollapsed, SIDEBAR_COOKIE } from "@/lib/sidebar-cookie";
import { getWorkspaceContext } from "@/lib/workspace-context";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The proxy already redirects; this keeps the guarantee if the proxy is bypassed.
  if (!getSupabasePublicConfig().configured) redirect(SETUP_PATH);

  const { user } = await requireUser();
  // Reminders and the inbox badge are best-effort chrome: never let them break the app shell. The
  // workspace lookup stays inside the guard too, so a failure surfaces in the page's error
  // boundary (which sits below this layout) instead of replacing the whole shell.
  const noReminders: Reminder[] = [];
  const chrome: Promise<[Reminder[], number]> = getWorkspaceContext().then(
    (ctx) =>
      Promise.all([loadReminders(ctx).catch(() => noReminders), countInbox(ctx).catch(() => 0)]),
    () => [noReminders, 0],
  );
  const [[reminders, inboxCount], cookieStore] = await Promise.all([chrome, cookies()]);
  return (
    <AppShell
      account={{ email: user.email }}
      reminders={reminders}
      inboxCount={inboxCount}
      initialCollapsed={isSidebarCollapsed(cookieStore.get(SIDEBAR_COOKIE)?.value)}
    >
      {children}
    </AppShell>
  );
}
