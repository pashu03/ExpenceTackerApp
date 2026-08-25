import { forwardRef } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, id, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  const descriptionId = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <label className="grid gap-1.5 text-sm font-medium" htmlFor={inputId}>
      <span>{label}</span>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        className={cn(
          "min-h-11 w-full rounded-xl border bg-[var(--surface)] px-3.5 py-2.5 text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)]",
          error
            ? "border-[var(--danger)] focus:border-[var(--danger)]"
            : "border-[var(--border)] focus:border-[var(--focus)]",
          className,
        )}
        {...props}
      />
      {error ? (
        <span id={descriptionId} role="alert" className="text-xs text-[var(--danger)]">
          {error}
        </span>
      ) : hint ? (
        <span id={descriptionId} className="text-xs font-normal text-[var(--text-muted)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
});

