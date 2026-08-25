export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

