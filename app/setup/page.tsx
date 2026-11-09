import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StandaloneShell } from "@/components/layout/standalone-shell";
import { SetupNotice } from "@/components/shared/setup-notice";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { getSupabasePublicConfig } from "@/lib/env";

export const metadata: Metadata = { title: "Setup required" };

export default function SetupPage() {
  const config = getSupabasePublicConfig();
  if (config.configured) redirect(LOGIN_PATH);

  return (
    <StandaloneShell width="lg">
      <SetupNotice problems={config.problems} />
    </StandaloneShell>
  );
}
