import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { SETUP_PATH } from "@/lib/auth/routes";
import { getSupabasePublicConfig } from "@/lib/env";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The proxy already redirects; this keeps the guarantee if the proxy is bypassed.
  if (!getSupabasePublicConfig().configured) redirect(SETUP_PATH);

  const { user } = await requireUser();
  return <AppShell account={{ email: user.email }}>{children}</AppShell>;
}
