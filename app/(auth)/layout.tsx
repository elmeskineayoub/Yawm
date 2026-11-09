import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { StandaloneShell } from "@/components/layout/standalone-shell";
import { SETUP_PATH } from "@/lib/auth/routes";
import { getSupabasePublicConfig } from "@/lib/env";

export default function AuthLayout({ children }: { children: ReactNode }) {
  if (!getSupabasePublicConfig().configured) redirect(SETUP_PATH);
  return <StandaloneShell card>{children}</StandaloneShell>;
}
