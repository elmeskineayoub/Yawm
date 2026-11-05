"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { popoverClass } from "./surfaces";

/**
 * Action menu with full keyboard support (arrow keys, typeahead, Escape). Use for overflow
 * actions ("Convert to…", "Move to…") so rows stay quiet.
 */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuGroup = DropdownMenu.Group;
export const MenuRadioGroup = DropdownMenu.RadioGroup;

export function MenuContent({
  className,
  align = "end",
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(popoverClass, "min-w-44 p-1 text-sm", className)}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

const itemClass =
  "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-muted [&>svg]:size-4 [&>svg]:text-muted-foreground";

export function MenuItem({
  className,
  tone,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Item> & { tone?: "danger" }) {
  return (
    <DropdownMenu.Item
      className={cn(itemClass, tone === "danger" && "text-danger [&>svg]:text-danger", className)}
      {...props}
    />
  );
}

export function MenuRadioItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem className={cn(itemClass, "pr-7", className)} {...props}>
      {children}
      <DropdownMenu.ItemIndicator className="ml-auto">
        <Check aria-hidden className="size-4 text-accent" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="label-caps px-2 pt-1.5 pb-1">{children}</DropdownMenu.Label>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}
