"use client";

import { ThemeProvider, useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      // On phones, clear the bottom tab bar (4rem) and the home-indicator inset.
      mobileOffset={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
      closeButton
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* One provider so tooltips share a delay: after the first, neighbours open instantly. */}
      <TooltipProvider delayDuration={400} skipDelayDuration={300}>
        {children}
      </TooltipProvider>
      <ThemedToaster />
    </ThemeProvider>
  );
}
