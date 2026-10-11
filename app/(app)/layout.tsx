import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getSupabasePublicConfig } from "@/lib/env";

export default function AppLayout({ children }: { children: ReactNode }) {
  const supabase = getSupabasePublicConfig();

  return (
    <AppShell>
      {!supabase.configured && <SetupNotice problems={supabase.problems} />}
      {children}
    </AppShell>
  );
}
