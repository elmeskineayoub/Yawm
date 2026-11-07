import { LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import type { ShellLayout } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ShortcutsButton } from "./keyboard-shortcuts";
import { ThemeToggle } from "./theme-toggle";

const LABEL: Record<ShellLayout, string> = {
  full: "",
  rail: "sr-only",
  responsive: "max-lg:sr-only",
};
const ROW: Record<ShellLayout, string> = {
  full: "gap-3 px-3",
  rail: "justify-center px-0",
  responsive: "gap-3 px-3 max-lg:justify-center max-lg:px-0",
};
const EXPANDED_ONLY: Record<ShellLayout, string> = {
  full: "",
  rail: "hidden",
  responsive: "max-lg:hidden",
};

export function AccountMenu({ email, layout }: { email: string | null; layout: ShellLayout }) {
  return (
    <div className="space-y-1 border-t border-border p-2">
      <div
        className={cn("flex items-center justify-between gap-2 px-3 pt-1", EXPANDED_ONLY[layout])}
      >
        {email && (
          <p className="min-w-0 truncate text-xs text-muted-foreground" title={email}>
            {email}
          </p>
        )}
        <ThemeToggle />
      </div>
      <ShortcutsButton className={ROW[layout]} labelClass={LABEL[layout]} />
      <form action={signOut}>
        <button
          type="submit"
          title={layout === "full" ? undefined : "Sign out"}
          className={cn(
            "flex h-9 w-full items-center rounded-md text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            ROW[layout],
          )}
        >
          <LogOut aria-hidden className="size-4" />
          <span className={LABEL[layout]}>Sign out</span>
        </button>
      </form>
    </div>
  );
}
