import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { SETUP_PATH } from "@/lib/auth/routes";
import { getSupabasePublicConfig } from "@/lib/env";

export default function AuthLayout({ children }: { children: ReactNode }) {
  if (!getSupabasePublicConfig().configured) redirect(SETUP_PATH);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandLogo heightRem={2} />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
