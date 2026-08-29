"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BellRing, BookHeart, Check, Goal, HandCoins, Plus, WalletCards } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { trackingApi } from "@/features/tracking/api";
import { currentMonth, dateForTimezone, formatDate, moneyFormatter } from "@/features/tracking/utils";

const quickActions = [
  { href: "/expenses/new", label: "Add expense", icon: Plus },
  { href: "/income?create=true", label: "Add income", icon: HandCoins },
  { href: "/my-day?date=today", label: "Write today's journal", icon: BookHeart },
  { href: "/goals?create=true", label: "Create goal", icon: Goal },
];

export function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const summaryQuery = useQuery({
    queryKey: ["monthly-summary", currentMonth()],
    queryFn: () => trackingApi.summary(currentMonth()),
    enabled: Boolean(user),
  });
  const reminderQuery = useQuery({
    queryKey: ["reminders", "dashboard"],
    queryFn: () => trackingApi.reminders(),
    enabled: Boolean(user?.preferences.notifications_enabled),
  });
  const completeReminder = useMutation({
    mutationFn: (id: string) => trackingApi.saveReminder({ completed: true }, id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reminders"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      ]);
      showToast("Reminder completed.");
    },
  });
  if (!user) return null;
  if (summaryQuery.isLoading) return <LoadingState label="Loading your dashboard..." />;
  if (summaryQuery.isError) return <ErrorState retry={() => void summaryQuery.refetch()} />;

  const summary = summaryQuery.data;
  if (!summary) return null;
  const money = moneyFormatter(user);
  const firstName = user.name.split(" ")[0];
  const today = dateForTimezone(user.preferences.timezone);
  const dueReminders = (reminderQuery.data ?? []).filter(
    (item) => !item.completed && item.due_on <= today,
  );
  const onboarding = [
    { done: Number(summary.income) > 0, label: "Add your first income", href: "/income?create=true" },
    { done: Number(summary.expenses) > 0, label: "Record your first expense", href: "/expenses/new" },
    { done: summary.active_goals > 0, label: "Create a financial goal", href: "/goals?create=true" },
  ];
  const onboardingComplete = onboarding.every((item) => item.done);
  const stats = [
    { label: "Monthly income", value: money.format(Number(summary.income)), icon: HandCoins, tone: "text-[var(--success)]" },
    { label: "Monthly expenses", value: money.format(Number(summary.expenses)), icon: WalletCards, tone: "text-[var(--warning)]" },
    { label: "Net cash flow", value: money.format(Number(summary.net_savings)), icon: ArrowUpRight, tone: Number(summary.net_savings) >= 0 ? "text-[var(--brand)]" : "text-[var(--danger)]" },
    { label: "Active goals", value: String(summary.active_goals), icon: Goal, tone: "text-[var(--brand)]" },
  ];

  return (
    <div className="grid gap-6 sm:gap-8">
      <header>
        <p className="text-sm font-medium text-[var(--brand)]">Your financial home</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {firstName}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
          Today you have recorded {money.format(Number(summary.today_expenses))} in spending. Keep
          adding small entries to build a clear monthly picture.
        </p>
      </header>

      {!onboardingComplete ? (
        <Card className="border-[var(--brand)]/25 bg-[var(--brand-soft)]">
          <CardHeader><h2 className="font-semibold">Finish setting up your workspace</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Complete these basics to unlock a useful monthly picture.</p></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">{onboarding.map((item) => <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-3 text-sm font-medium"><span className={`grid size-7 place-items-center rounded-full ${item.done ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--text-muted)]"}`}>{item.done ? <Check size={15} /> : <Plus size={15} />}</span><span className={item.done ? "text-[var(--text-muted)] line-through" : ""}>{item.label}</span></Link>)}</CardContent>
        </Card>
      ) : null}

      {user.preferences.notifications_enabled && dueReminders.length ? (
        <Card className="border-[color-mix(in_srgb,var(--warning)_35%,var(--border))]">
          <CardHeader className="flex-row items-center justify-between gap-4"><div><h2 className="flex items-center gap-2 font-semibold"><BellRing size={18} className="text-[var(--warning)]" /> Due reminders</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{dueReminders.length} item{dueReminders.length === 1 ? " needs" : "s need"} your attention.</p></div><Link href="/calendar" className="text-sm font-semibold text-[var(--brand)]">Open calendar</Link></CardHeader>
          <CardContent className="grid gap-2">{dueReminders.slice(0, 4).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[var(--surface-subtle)] px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">Due {formatDate(item.due_on)}</p></div><Button variant="ghost" className="shrink-0" disabled={completeReminder.isPending} onClick={() => completeReminder.mutate(item.id)}><Check size={16} /> Done</Button></div>)}</CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="summary-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="summary-heading" className="font-semibold">This month</h2>
          <span className="text-xs text-[var(--text-muted)]">Recorded amounts</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="shadow-none">
                <CardContent className="flex items-start justify-between gap-4 p-5 sm:p-5">
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">{stat.label}</p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight">{stat.value}</p>
                  </div>
                  <span className={`grid size-10 place-items-center rounded-xl bg-[var(--surface-subtle)] ${stat.tone}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {summary.goal_projections.length ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4"><div><h2 className="font-semibold">Goal saving plan</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Live plan based on this month&apos;s recorded income and expenses.</p></div><Link href="/goals" className="shrink-0 text-sm font-semibold text-[var(--brand)]">Manage goals</Link></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Available after expenses</p><p className="mt-2 text-xl font-semibold">{money.format(Number(summary.available_after_expenses))}</p></div><div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Planned for goals</p><p className="mt-2 text-xl font-semibold text-[var(--brand)]">{money.format(Number(summary.planned_goal_contributions))}</p></div><div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Spending limit after goal plan</p><p className="mt-2 text-xl font-semibold">{money.format(Number(summary.recommended_spending_limit))}</p></div></CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Quick actions</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Add or update the information that matters today.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex min-h-16 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-subtle)] text-[var(--brand)] group-hover:bg-[var(--surface)]">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    {action.label}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-[color-mix(in_srgb,var(--brand)_24%,var(--border))] bg-[var(--brand-soft)] text-[var(--text)]">
          <CardContent className="flex min-h-full flex-col justify-between gap-8 p-6 sm:p-7">
            <div>
              <span className="inline-flex rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--brand)] shadow-sm">
                Monthly focus
              </span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">{summary.suggestions[0]?.title ?? "Keep tracking your month"}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                {summary.suggestions[0]?.description ?? "Your evidence-based suggestions will appear here."}
              </p>
            </div>
            <Link href="/analytics" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)]">
              View monthly analysis <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {summary.recent_expenses.length ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Recent expenses</h2></CardHeader>
          <CardContent className="grid gap-2">
            {summary.recent_expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-subtle)] px-4 py-3 text-sm">
                <div><p className="font-medium">{expense.description || expense.category}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{expense.category} · {formatDate(expense.spent_on)}</p></div>
                <strong>{money.format(Number(expense.amount))}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
