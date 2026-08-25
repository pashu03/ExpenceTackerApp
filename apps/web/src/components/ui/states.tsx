import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "./button";

export function LoadingState({ label = "Loading your space…" }: { label?: string }) {
  return (
    <div className="grid min-h-64 place-items-center text-center text-[var(--text-muted)]">
      <div className="grid gap-3 justify-items-center">
        <LoaderCircle className="animate-spin" aria-hidden="true" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] p-6 text-center">
      <div className="grid max-w-md justify-items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
          <Inbox aria-hidden="true" size={20} />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

export function ErrorState({ retry }: { retry?: () => void }) {
  return (
    <div role="alert" className="grid min-h-52 place-items-center text-center">
      <div className="grid max-w-sm justify-items-center gap-3">
        <AlertCircle className="text-[var(--danger)]" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">Something went wrong</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            We could not load this information. Your data has not been changed.
          </p>
        </div>
        {retry ? <Button onClick={retry}>Try again</Button> : null}
      </div>
    </div>
  );
}

