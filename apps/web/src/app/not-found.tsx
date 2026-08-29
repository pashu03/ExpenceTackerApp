import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold text-[var(--brand)]">404</p>
        <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">The page may have moved, or the address may be incorrect.</p>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white">Return to dashboard</Link>
      </div>
    </main>
  );
}
