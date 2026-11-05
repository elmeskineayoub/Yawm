import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "icon" | "icon-sm";

const variants: Record<ButtonVariant, string> = {
  /** The one main action in a region. */
  primary: "bg-accent text-accent-foreground hover:bg-accent/90",
  /** Quiet filled button for secondary actions. */
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  /** Bordered button that reads clearly next to form controls. */
  outline: "border border-input-border bg-transparent text-foreground hover:bg-surface-muted",
  /** Text-only, for toolbars and inline actions. */
  ghost: "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
  /** Destructive confirmation. */
  danger: "bg-danger text-danger-foreground hover:bg-danger/90",
};

const sizes: Record<ButtonSize, string> = {
  /** Compact inline actions inside rows and panels. */
  xs: "min-h-7 gap-1 px-2 py-0.5 text-xs",
  sm: "min-h-8 gap-1.5 px-3 py-1 text-[0.8125rem]",
  md: "min-h-9 gap-2 px-4 py-1.5 text-sm",
  icon: "size-9",
  "icon-sm": "size-8",
};

/** Class string for links that should look like buttons. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string | undefined } = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-md text-center font-medium transition-colors duration-150 select-none disabled:cursor-not-allowed disabled:opacity-55",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}
