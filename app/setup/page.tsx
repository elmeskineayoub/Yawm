import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { SetupNotice } from "@/components/shared/setup-notice";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { getSupabasePublicConfig } from "@/lib/env";

export const metadata: Metadata = { title: "Setup required" };

export default function SetupPage() {
  const config = getSupabasePublicConfig();
  if (config.configured) redirect(LOGIN_PATH);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <BrandLogo heightRem={2} />
        </div>
        <SetupNotice problems={config.problems} />
      </div>
    </main>
  );
}
