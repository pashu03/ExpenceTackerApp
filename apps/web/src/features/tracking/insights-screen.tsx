"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Clock3, Lightbulb, PiggyBank, ShieldCheck, TrendingUp } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuth } from "@/features/auth/auth-provider";
import { trackingApi } from "./api";
import { currentMonth, formatGoalDuration, moneyFormatter } from "./utils";

export function InsightsScreen() {
  const { user } = useAuth();
  const money = moneyFormatter(user);
  const [month, setMonth] = useState(currentMonth());
  const query = useQuery({
    queryKey: ["insights", month],
    queryFn: async () => {
      const [summary, budgets] = await Promise.all([
        trackingApi.analytics(month),
        trackingApi.budgets(month),
      ]);
      return { summary, budgets };
    },
  });

  const data = query.data;
  const overBudget = data?.budgets.filter((item) => Number(item.remaining_amount) < 0) ?? [];
  const topCategory = data?.summary.categories[0];

  return (
    <div>
      <PageHeader eyebrow="Clear, explainable guidance" title="Smart insights" description="Practical observations calculated only from the data you record—without inventing facts or sharing your journal." action={<div className="min-w-48"><Input label="Review month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>} />
      {query.isLoading ? <LoadingState label="Calculating insights..." /> : null}
      {query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
      {data ? <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="p-5"><TrendingUp className={Number(data.summary.net_savings) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"} size={22} /><p className="mt-4 text-sm text-[var(--text-muted)]">Monthly cash flow</p><p className="mt-1 text-2xl font-semibold">{money.format(Number(data.summary.net_savings))}</p><p className="mt-2 text-sm leading-5 text-[var(--text-muted)]">Income minus all recorded expenses for this calendar month.</p></CardContent></Card>
          <Card><CardContent className="p-5"><PiggyBank className="text-[var(--brand)]" size={22} /><p className="mt-4 text-sm text-[var(--text-muted)]">Largest spending area</p><p className="mt-1 text-2xl font-semibold">{topCategory?.category ?? "No data"}</p><p className="mt-2 text-sm leading-5 text-[var(--text-muted)]">{topCategory ? `${money.format(Number(topCategory.amount))} (${topCategory.percentage}% of spending).` : "Add expenses to identify your largest category."}</p></CardContent></Card>
          <Card><CardContent className="p-5"><CircleAlert className={overBudget.length ? "text-[var(--danger)]" : "text-[var(--success)]"} size={22} /><p className="mt-4 text-sm text-[var(--text-muted)]">Budget health</p><p className="mt-1 text-2xl font-semibold">{overBudget.length ? `${overBudget.length} over limit` : data.budgets.length ? "On track" : "Not planned"}</p><p className="mt-2 text-sm leading-5 text-[var(--text-muted)]">{data.budgets.length ? `${data.budgets.length} category budget${data.budgets.length === 1 ? "" : "s"} checked against actual expenses.` : "Create budgets to receive category-level warnings."}</p></CardContent></Card>
        </section>
        <Card>
          <CardHeader><h2 className="flex items-center gap-2 font-semibold"><PiggyBank size={19} className="text-[var(--brand)]" /> Income and goal plan</h2><p className="mt-1 text-sm text-[var(--text-muted)]">These figures recalculate whenever income, expenses, or a goal contribution changes.</p></CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Recorded income</p><p className="mt-2 text-lg font-semibold">{money.format(Number(data.summary.income))}</p></div>
              <div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Available after expenses</p><p className="mt-2 text-lg font-semibold">{money.format(Number(data.summary.available_after_expenses))}</p></div>
              <div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Planned goal saving</p><p className="mt-2 text-lg font-semibold text-[var(--brand)]">{money.format(Number(data.summary.planned_goal_contributions))}</p></div>
              <div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Monthly spending limit</p><p className="mt-2 text-lg font-semibold">{money.format(Number(data.summary.recommended_spending_limit))}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Income minus planned goal saving.</p></div>
            </div>
            {data.summary.goal_projections.length ? <div className="grid gap-3 md:grid-cols-2">{data.summary.goal_projections.map((projection) => <div key={projection.goal_id} className="rounded-xl border border-[var(--border)] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{projection.name}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{projection.income_percentage === null ? "Add income to calculate salary share" : `${projection.income_percentage}% of recorded income planned`}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${projection.affordability_status === "overcommitted" ? "bg-[var(--surface-subtle)] text-[var(--danger)]" : "bg-[var(--brand-soft)] text-[var(--brand)]"}`}>{projection.affordability_status.replaceAll("_", " ")}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-[var(--text-muted)]">Your contribution</p><p className="mt-1 font-semibold">{money.format(Number(projection.monthly_contribution))}/month</p></div><div><p className="text-xs text-[var(--text-muted)]">Equal-share suggestion</p><p className="mt-1 font-semibold">{money.format(Number(projection.recommended_monthly_contribution))}/month</p></div></div><p className="mt-3 flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="text-[var(--brand)]" /> {formatGoalDuration(projection.estimated_days)}</p><p className="mt-2 text-sm leading-5 text-[var(--text-muted)]">{projection.recommendation}</p></div>)}</div> : <p className="rounded-xl bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-muted)]">Create an active financial goal to receive a monthly contribution plan and completion estimate.</p>}
          </CardContent>
        </Card>
        <Card><CardHeader><h2 className="flex items-center gap-2 font-semibold"><Lightbulb size={19} className="text-[var(--warning)]" /> Recommended next steps</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Every suggestion below comes from a visible total or a fixed calculation rule.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{data.summary.suggestions.map((item) => { const Icon = item.type === "warning" ? CircleAlert : item.type === "positive" ? TrendingUp : PiggyBank; return <div key={item.title} className="rounded-xl border border-[var(--border)] p-4"><Icon size={20} className={item.type === "warning" ? "text-[var(--danger)]" : "text-[var(--brand)]"} /><h3 className="mt-3 font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.description}</p>{item.potential_monthly_saving ? <p className="mt-3 text-sm font-semibold text-[var(--success)]">Potential monthly saving: {money.format(Number(item.potential_monthly_saving))}</p> : null}</div>; })}</CardContent></Card>
        <Card className="border-[var(--brand)]/25 bg-[var(--brand-soft)]"><CardContent className="flex items-start gap-3 p-5"><ShieldCheck className="mt-0.5 shrink-0 text-[var(--brand)]" size={20} /><div><h2 className="font-semibold">Privacy-first calculations</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">These insights run from your saved totals and deterministic rules. Journal text is not analyzed, and no external AI provider receives your personal data.</p></div></CardContent></Card>
      </div> : null}
    </div>
  );
}
