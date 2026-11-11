import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge has to know the project's own token names (app/globals.css @theme). Otherwise it
 * takes `text-caption` for a text colour and drops it when a colour class follows.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["title", "label", "prose", "display", "h2", "caption"],
      spacing: ["card", "card-sm", "gutter", "section", "section-sm", "tap"],
      radius: ["card", "control", "bar"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
