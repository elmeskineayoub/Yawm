import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";

export const metadata: Metadata = { title: "Link problem" };

export default function AuthErrorPage() {
  // The reason is not echoed from the URL, so the page cannot be used to display injected text.
  return (
    <>
      <AuthHeading
        title="This link didn't work"
        description="It may have expired or already been used. Links are valid for one hour."
      />
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
        <Link href="/forgot-password" className="text-accent hover:underline">
          Request a new password reset link
        </Link>
        <Link href="/sign-up" className="text-accent hover:underline">
          Sign up again to get a new confirmation link
        </Link>
      </div>
    </>
  );
}
