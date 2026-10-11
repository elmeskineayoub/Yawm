import { LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

export function AccountMenu({ email, collapsed }: { email: string | null; collapsed: boolean }) {
  return (
    <div className="border-t border-border p-2">
      {!collapsed && email && (
        <p className="truncate px-3 pb-1 pt-2 text-xs text-muted-foreground" title={email}>
          {email}
        </p>
      )}
      <form action={signOut}>
        <button
          type="submit"
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut aria-hidden className="size-4" />
          <span className={cn(collapsed && "sr-only")}>Sign out</span>
        </button>
      </form>
    </div>
  );
}
