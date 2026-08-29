"use client";

import {
  BarChart3,
  BookHeart,
  Lightbulb,
  CalendarDays,
  CircleDollarSign,
  Goal,
  HandCoins,
  House,
  Leaf,
  LogOut,
  Menu,
  Plus,
  Settings,
  Target,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

const desktopNavigation = [
  { href: "/dashboard", label: "Dashboard", icon: House },
  { href: "/expenses", label: "Expenses", icon: WalletCards },
  { href: "/income", label: "Income", icon: HandCoins },
  { href: "/budgets", label: "Budgets", icon: Target },
  { href: "/my-day", label: "My Day", icon: BookHeart },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/goals", label: "Goals", icon: Goal },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobileNavigation = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/expenses", label: "Expenses", icon: WalletCards },
  { href: "/expenses/new", label: "Add", icon: Plus, emphasized: true },
  { href: "/my-day", label: "Journal", icon: BookHeart },
  { href: "/goals", label: "Goals", icon: Goal },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  async function signOut() {
    await logout();
    router.replace("/login");
  }

  const navigation = (
    <nav aria-label="Primary navigation" className="grid gap-1">
      {desktopNavigation.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
              active && "bg-[var(--brand-soft)] text-[var(--brand)]",
            )}
          >
            <Icon size={19} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[16.5rem] border-r border-[var(--border)] bg-[var(--surface)] p-4 lg:flex lg:flex-col">
        <Link href="/dashboard" className="mb-7 flex items-center gap-2 px-2 text-lg font-semibold">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--brand)] text-white">
            <Leaf size={19} aria-hidden="true" />
          </span>
          LifeTracker
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">{navigation}</div>
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <div className="flex items-center gap-2 rounded-xl px-2 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <UserRound size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              className="size-12 shrink-0 px-0 text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--danger)_9%,var(--surface))] hover:text-[var(--danger)]"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={32} strokeWidth={2.25} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/35"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative h-full w-[85%] max-w-xs bg-[var(--surface)] p-4 shadow-2xl">
            <div className="mb-7 flex items-center justify-between">
              <span className="flex items-center gap-2 text-lg font-semibold">
                <span className="grid size-9 place-items-center rounded-xl bg-[var(--brand)] text-white">
                  <Leaf size={19} />
                </span>
                LifeTracker
              </span>
              <Button variant="ghost" className="size-10 px-0" onClick={() => setMobileMenuOpen(false)}>
                <X size={20} />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>
            <div className="flex h-[calc(100%-4rem)] flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">{navigation}</div>
              <div className="mt-4 flex items-center gap-2 border-t border-[var(--border)] px-2 pt-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <UserRound size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user?.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{user?.email}</p>
                </div>
                <Button
                  variant="ghost"
                  className="size-12 shrink-0 px-0 text-[var(--text-muted)] hover:text-[var(--danger)]"
                  onClick={signOut}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={30} strokeWidth={2.25} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            className="size-11 px-0 lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={21} />
          </Button>
          <div className="hidden items-center gap-2 text-sm text-[var(--text-muted)] lg:flex">
            <CircleDollarSign size={17} className="text-[var(--brand)]" />
            Your private financial space
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" className="size-11 px-0 lg:hidden" onClick={signOut} aria-label="Sign out">
              <LogOut size={22} />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[90rem] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid h-[4.75rem] grid-cols-5 border-t border-[var(--border)] bg-[var(--surface)] px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium text-[var(--text-muted)]",
                active && "text-[var(--brand)]",
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-xl",
                  item.emphasized && "-mt-5 size-12 rounded-2xl bg-[var(--brand)] text-white shadow-lg",
                  active && !item.emphasized && "bg-[var(--brand-soft)]",
                )}
              >
                <Icon size={item.emphasized ? 23 : 19} aria-hidden="true" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
