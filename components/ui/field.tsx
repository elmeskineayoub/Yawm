import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Shared look for text inputs, selects, and textareas: a light surface with a 3:1 border, a darker
 * border on hover, and an accent border plus soft halo on focus. Invalid controls turn danger.
 * `control` hooks the custom select chevron in globals.css.
 */
export const controlClass =
  "control block w-full rounded-md border border-input-border bg-surface px-3 py-2 text-sm text-foreground shadow-[inset_0_1px_0_rgb(0_0_0/0.02)] transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/20 focus-visible:outline-none aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-muted-foreground";

type FieldShellProps = {
  label: string;
  hideLabel?: boolean | undefined;
  errors?: string[] | undefined;
  hint?: string | undefined;
  className?: string | undefined;
  children: (props: {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
  }) => ReactNode;
};

/** Label, hint, and error wiring shared by every form control. */
export function FieldShell({
  label,
  hideLabel,
  errors,
  hint,
  className,
  children,
}: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errors?.length);
  const describedBy = [hint && hintId, hasError && errorId].filter(Boolean).join(" ");

  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className={cn("block text-sm font-medium", hideLabel && "sr-only")}>
        {label}
      </label>
      {children({
        id,
        "aria-invalid": hasError || undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="text-xs text-danger">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}

type Common = {
  label: string;
  name: string;
  hideLabel?: boolean;
  errors?: string[] | undefined;
  hint?: string;
  className?: string;
};

export function InputField({
  label,
  hideLabel,
  errors,
  hint,
  className,
  ...props
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell {...{ label, hideLabel, errors, hint, className }}>
      {(aria) => <input {...aria} className={controlClass} {...props} />}
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hideLabel,
  errors,
  hint,
  className,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell {...{ label, hideLabel, errors, hint, className }}>
      {(aria) => <textarea {...aria} className={cn(controlClass, "min-h-24")} {...props} />}
    </FieldShell>
  );
}

export type Option = { value: string; label: string };

export function SelectField({
  label,
  hideLabel,
  errors,
  hint,
  className,
  options,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: readonly Option[] }) {
  return (
    <FieldShell {...{ label, hideLabel, errors, hint, className }}>
      {(aria) => (
        <select {...aria} className={controlClass} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
