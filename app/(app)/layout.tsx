import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { loadReminders } from "@/features/reminders/queries";
import { requireUser } from "@/lib/auth/session";
import { SETUP_PATH } from "@/lib/auth/routes";
import { getSupabasePublicConfig } from "@/lib/env";
import { getWorkspaceContext } from "@/lib/workspace-context";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The proxy already redirects; this keeps the guarantee if the proxy is bypassed.
  if (!getSupabasePublicConfig().configured) redirect(SETUP_PATH);

  const { user } = await requireUser();
  // Reminders are best-effort chrome: never let them break the whole app shell.
  let reminders: Awaited<ReturnType<typeof loadReminders>> = [];
  try {
    reminders = await loadReminders(await getWorkspaceContext());
  } catch {
    reminders = [];
  }
  return (
    <AppShell account={{ email: user.email }} reminders={reminders}>
      {children}
    </AppShell>
  );
}
