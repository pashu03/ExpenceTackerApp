import { forwardRef } from "react";
import { cn } from "@/lib/cn";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, error, id, children, ...props },
  ref,
) {
  const selectId = id ?? props.name;
  return (
    <label className="grid gap-1.5 text-sm font-medium" htmlFor={selectId}>
      <span>{label}</span>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={Boolean(error)}
        className={cn(
          "min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[var(--text)] outline-none focus:border-[var(--focus)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </label>
  );
});

