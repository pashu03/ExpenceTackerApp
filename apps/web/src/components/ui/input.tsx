"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  revealable?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, id, revealable = false, type, ...props },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const inputId = id ?? props.name;
  const descriptionId = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const canReveal = revealable && type === "password";

  return (
    <div className="grid gap-1.5 text-sm font-medium">
      <label htmlFor={inputId}>{label}</label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={canReveal && revealed ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          className={cn(
            "min-h-11 w-full rounded-xl border bg-[var(--surface)] px-3.5 py-2.5 text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)]",
            error
              ? "border-[var(--danger)] focus:border-[var(--danger)]"
              : "border-[var(--border)] focus:border-[var(--focus)]",
            canReveal && "pr-12",
            className,
          )}
          {...props}
        />
        {canReveal ? (
          <button
            type="button"
            className="absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]"
            aria-label={`${revealed ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={revealed}
            aria-controls={inputId}
            disabled={props.disabled}
            onClick={() => setRevealed((current) => !current)}
          >
            {revealed ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <span id={descriptionId} role="alert" className="text-xs text-[var(--danger)]">
          {error}
        </span>
      ) : hint ? (
        <span id={descriptionId} className="text-xs font-normal text-[var(--text-muted)]">
          {hint}
        </span>
      ) : null}
    </div>
  );
});
