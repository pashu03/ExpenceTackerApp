import { forwardRef } from "react";
import { cn } from "@/lib/cn";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, error, hint, id, ...props },
  ref,
) {
  const textareaId = id ?? props.name;
  const descriptionId = error
    ? `${textareaId}-error`
    : hint
      ? `${textareaId}-hint`
      : undefined;
  return (
    <label className="grid gap-1.5 text-sm font-medium" htmlFor={textareaId}>
      <span>{label}</span>
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        className={cn(
          "min-h-32 w-full resize-y rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)]",
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
