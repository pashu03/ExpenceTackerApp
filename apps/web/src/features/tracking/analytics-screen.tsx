"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Lightbulb, PiggyBank, TrendingUp } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuth } from "@/features/auth/auth-provider";
import { trackingApi } from "./api";
import { currentMonth, formatDate, moneyFormatter } from "./utils";

export function AnalyticsScreen() {
  const { user } = useAuth();
  const money = moneyFormatter(user);
  const [month, setMonth] = useState(currentMonth());
  const query = useQuery({ queryKey: ["monthly-summary", month], queryFn: () => trackingApi.analytics(month) });
  const summary = query.data;

  return <div>
    <PageHeader eyebrow="Monthly review" title="Spending analysis" description="See your totals, biggest categories, daily spending, and practical ways to save more." action={<div className="min-w-48"><Input label="Analyze month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>} />
    {query.isLoading ? <LoadingState label="Analyzing your month..." /> : null}{query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
    {summary ? <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Income", value: summary.income, tone: "text-[var(--success)]" }, { label: "Expenses", value: summary.expenses, tone: "text-[var(--warning)]" }, { label: "Net savings", value: summary.net_savings, tone: Number(summary.net_savings) >= 0 ? "text-[var(--brand)]" : "text-[var(--danger)]" }, { label: "Savings rate", value: null, text: summary.savings_rate === null ? "Add income" : `${summary.savings_rate}%`, tone: "text-[var(--brand)]" }].map((stat) => <Card key={stat.label} className="shadow-none"><CardContent className="p-5"><p className="text-sm text-[var(--text-muted)]">{stat.label}</p><p className={`mt-2 text-2xl font-semibold ${stat.tone}`}>{stat.text ?? money.format(Number(stat.value))}</p></CardContent></Card>)}
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><h2 className="font-semibold">Spending by category</h2></CardHeader><CardContent className="grid gap-4">{summary.categories.length ? summary.categories.map((item) => <div key={item.category}><div className="mb-1.5 flex justify-between gap-4 text-sm"><span className="font-medium">{item.category}</span><span>{money.format(Number(item.amount))} · {item.percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(Number(item.percentage), 100)}%` }} /></div></div>) : <p className="py-8 text-center text-sm text-[var(--text-muted)]">No expenses recorded for this month.</p>}</CardContent></Card>
        <Card><CardHeader><h2 className="font-semibold">Daily spending</h2></CardHeader><CardContent>{summary.daily_spending.length ? <div className="grid gap-2">{summary.daily_spending.map((item) => <div key={item.date} className="flex items-center justify-between rounded-xl bg-[var(--surface-subtle)] px-4 py-3 text-sm"><span>{formatDate(item.date)}</span><strong>{money.format(Number(item.amount))}</strong></div>)}</div> : <p className="py-8 text-center text-sm text-[var(--text-muted)]">Daily totals will appear after you add expenses.</p>}</CardContent></Card>
      </div>
      <Card><CardHeader><h2 className="flex items-center gap-2 font-semibold"><Lightbulb size={19} className="text-[var(--warning)]" /> Suggestions for this month</h2><p className="mt-1 text-sm text-[var(--text-muted)]">These use your recorded totals and fixed rules—no numbers are invented.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{summary.suggestions.map((item) => { const Icon = item.type === "warning" ? CircleAlert : item.type === "positive" ? TrendingUp : PiggyBank; return <div key={item.title} className="rounded-xl border border-[var(--border)] p-4"><Icon size={20} className={item.type === "warning" ? "text-[var(--danger)]" : "text-[var(--brand)]"} /><h3 className="mt-3 font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.description}</p>{item.potential_monthly_saving ? <p className="mt-3 text-sm font-semibold text-[var(--success)]">Potential: {money.format(Number(item.potential_monthly_saving))}</p> : null}</div>; })}</CardContent></Card>
    </div> : null}
  </div>;
}
