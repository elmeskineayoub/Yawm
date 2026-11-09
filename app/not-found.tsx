import type { Metadata } from "next";
import Link from "next/link";
import { StandaloneShell } from "@/components/layout/standalone-shell";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

/** Any URL that matches no route. Pages inside the app have their own, more specific not-found. */
export default function NotFound() {
  return (
    <StandaloneShell card>
      <h1 className="text-2xl">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The link may be mistyped, or the page has moved.
      </p>
      <Link href="/dashboard" className={buttonClass({ className: "mt-5 w-full" })}>
        Go to the Dashboard
      </Link>
    </StandaloneShell>
  );
}
