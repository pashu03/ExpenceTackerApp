import Link from "next/link";
import { Leaf } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AuthFormShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#123e35] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 -top-24 size-96 rounded-full bg-[#2c7665]/50 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2 text-lg font-semibold">
          <span className="grid size-9 place-items-center rounded-xl bg-white/12">
            <Leaf size={19} aria-hidden="true" />
          </span>
          LifeTracker
        </Link>
        <div className="relative max-w-xl pb-12">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-100/70">
            Money meets everyday life
          </p>
          <h2 className="text-5xl font-semibold leading-[1.08] tracking-tight">
            A calmer way to understand your money.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-emerald-50/75">
            Record what matters, see where your money goes, and make steady progress toward
            goals—without judgment or financial jargon.
          </p>
        </div>
      </section>

      <section className="grid min-h-screen place-items-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 font-semibold lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <Leaf size={19} aria-hidden="true" />
            </span>
            LifeTracker
          </Link>
          <Card className="p-6 sm:p-8">
            <header className="mb-7">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
            </header>
            {children}
            <div className="mt-6 text-center text-sm text-[var(--text-muted)]">{footer}</div>
          </Card>
          <p className="mt-6 text-center text-xs leading-5 text-[var(--text-muted)]">
            Your financial and journal data stays private to your account.
          </p>
        </div>
      </section>
    </main>
  );
}

