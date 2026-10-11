import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SETUP_PATH } from "@/lib/auth/routes";
import { getSupabasePublicConfig } from "@/lib/env";

export default function AuthLayout({ children }: { children: ReactNode }) {
  if (!getSupabasePublicConfig().configured) redirect(SETUP_PATH);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-semibold">Yawm</p>
        <div className="rounded-lg border border-border bg-surface p-6">{children}</div>
      </div>
    </main>
  );
}
