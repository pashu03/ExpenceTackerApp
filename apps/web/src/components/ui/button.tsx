import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", fullWidth = false, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" &&
          "bg-[var(--brand)] text-white shadow-sm hover:bg-[var(--brand-strong)]",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-subtle)]",
        variant === "ghost" &&
          "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
        variant === "danger" && "bg-[var(--danger)] text-white hover:opacity-90",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
});

