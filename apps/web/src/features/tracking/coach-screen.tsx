"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  Gauge,
  Lightbulb,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuth } from "@/features/auth/auth-provider";
import { trackingApi } from "./api";
import { type GoalProjection } from "./types";
import {
  calculateWhatIf,
  currentMonth,
  expenseCategories,
  formatDate,
  formatGoalDuration,
  moneyFormatter,
} from "./utils";

interface EditableAllocation {
  essential: number;
  goals: number;
  emergency: number;
  flexible: number;
}

export function CoachScreen() {
  const { user } = useAuth();
  const money = moneyFormatter(user);
  const [month, setMonth] = useState(currentMonth());
  const [allocationOverride, setAllocationOverride] = useState<EditableAllocation | null>(null);
  const [goalId, setGoalId] = useState("");
  const [reductionCategory, setReductionCategory] = useState("Food & Dining");
  const [monthlyReduction, setMonthlyReduction] = useState("1500");
  const query = useQuery({
    queryKey: ["monthly-summary", month],
    queryFn: () => trackingApi.summary(month),
  });
  const summary = query.data;

  if (query.isLoading) return <LoadingState label="Preparing your financial plan..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;
  if (!summary) return null;

  const suggested: EditableAllocation = {
    essential: Number(summary.salary_allocation.essential_expenses),
    goals: Number(summary.salary_allocation.goal_savings),
    emergency: Number(summary.salary_allocation.emergency_fund),
    flexible: Number(summary.salary_allocation.flexible_spending),
  };
  const allocation = allocationOverride ?? suggested;
  const totalAllocation = Object.values(allocation).reduce((sum, value) => sum + value, 0);
  const planningIncome = Number(summary.planning_income);
  const allocationDifference = planningIncome - totalAllocation;
  const adjustedSafeToSpend = Math.max(
    planningIncome
      - Math.max(Number(summary.spending_forecast.projected_monthly_spending), allocation.essential)
      - allocation.goals
      - allocation.emergency,
    0,
  );
  const prioritizedGoals = [...summary.goal_projections].sort(
    (left, right) => left.priority_rank - right.priority_rank,
  );
  const selectedGoal = prioritizedGoals.find((goal) => goal.goal_id === goalId) ?? prioritizedGoals[0];
  const whatIf = selectedGoal
    ? calculateWhatIf(
        Number(selectedGoal.remaining_amount),
        Number(selectedGoal.monthly_contribution),
        Number(monthlyReduction),
      )
    : null;

  function updateAllocation(field: keyof EditableAllocation, value: string) {
    setAllocationOverride({ ...allocation, [field]: Math.max(Number(value) || 0, 0) });
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Smart financial coach"
        title="Your monthly money plan"
        description="Turn salary, spending, and goals into a practical plan that updates with your records."
        action={
          <div className="min-w-48">
            <Input
              label="Plan month"
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setAllocationOverride(null);
              }}
            />
          </div>
        }
      />

      {summary.income_basis === "latest_salary" ? (
        <Card className="border-[var(--warning)]/35 bg-[var(--surface-subtle)]">
          <CardContent className="flex gap-3 p-4 sm:p-5">
            <AlertTriangle className="mt-0.5 shrink-0 text-[var(--warning)]" size={20} />
            <div>
              <p className="font-semibold">Planning uses your latest salary</p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                Recorded income for {month} is {money.format(Number(summary.income))}. For planning,
                LifeTracker uses {money.format(planningIncome)} from your latest salary dated {summary.latest_salary_date ? formatDate(summary.latest_salary_date) : "another month"}. It does not change the recorded monthly total.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BadgeIndianRupee} label="Planning income" value={money.format(planningIncome)} />
        <MetricCard icon={ShieldCheck} label="Safe to spend" value={money.format(adjustedSafeToSpend)} tone="text-[var(--success)]" />
        <MetricCard icon={TrendingDown} label="Spending forecast" value={money.format(Number(summary.spending_forecast.projected_monthly_spending))} />
        <MetricCard icon={Gauge} label="Financial health" value={`${summary.financial_health.score}/100`} detail={summary.financial_health.label} tone="text-[var(--brand)]" />
      </section>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div><h2 className="flex items-center gap-2 font-semibold"><PiggyBank size={19} className="text-[var(--brand)]" /> Smart salary allocation</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Adjust any amount to test a different monthly plan. Suggested values use current expenses and goal contributions.</p></div>
          {allocationOverride ? <Button variant="ghost" onClick={() => setAllocationOverride(null)}>Reset suggestion</Button> : null}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Input label="Essential expenses" type="number" min="0" step="100" value={allocation.essential} onChange={(event) => updateAllocation("essential", event.target.value)} />
            <Input label="Goal savings" type="number" min="0" step="100" value={allocation.goals} onChange={(event) => updateAllocation("goals", event.target.value)} />
            <Input label="Emergency fund" type="number" min="0" step="100" value={allocation.emergency} onChange={(event) => updateAllocation("emergency", event.target.value)} />
            <Input label="Flexible spending" type="number" min="0" step="100" value={allocation.flexible} onChange={(event) => updateAllocation("flexible", event.target.value)} />
          </div>
          <div className={`mt-4 rounded-xl border p-4 text-sm ${allocationDifference < 0 ? "border-[var(--danger)]/35 text-[var(--danger)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><span>Total allocated: <strong className="text-[var(--text)]">{money.format(totalAllocation)}</strong></span><span>{allocationDifference >= 0 ? `${money.format(allocationDifference)} still unallocated` : `${money.format(Math.abs(allocationDifference))} over salary`}</span></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader><h2 className="flex items-center gap-2 font-semibold"><Sparkles size={19} className="text-[var(--brand)]" /> What-if simulator</h2><p className="mt-1 text-sm text-[var(--text-muted)]">See how redirecting a monthly expense reduction can accelerate one goal.</p></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Reduce category" value={reductionCategory} onChange={(event) => setReductionCategory(event.target.value)}>{expenseCategories.map((category) => <option key={category}>{category}</option>)}</Select>
              <Input label="Monthly reduction" type="number" min="0" step="100" value={monthlyReduction} onChange={(event) => setMonthlyReduction(event.target.value)} />
              <Select label="Redirect to goal" value={selectedGoal?.goal_id ?? ""} disabled={!selectedGoal} onChange={(event) => setGoalId(event.target.value)}>{prioritizedGoals.map((goal) => <option key={goal.goal_id} value={goal.goal_id}>{goal.name}</option>)}</Select>
            </div>
            {selectedGoal && whatIf ? (
              <div className="rounded-xl bg-[var(--brand-soft)] p-4">
                <p className="text-sm text-[var(--text-muted)]">Reduce {reductionCategory} by <strong className="text-[var(--text)]">{money.format(Number(monthlyReduction) || 0)}/month</strong> and add it to {selectedGoal.name}.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-lg font-semibold"><span>{whatIf.currentMonths ?? "—"} months</span><ArrowRight size={18} className="text-[var(--brand)]" /><span className="text-[var(--success)]">{whatIf.improvedMonths ?? "—"} months</span></div>
                <p className="mt-2 text-sm font-semibold text-[var(--brand)]">Goal could be reached {whatIf.monthsEarlier} month{whatIf.monthsEarlier === 1 ? "" : "s"} earlier.</p>
              </div>
            ) : <p className="rounded-xl bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-muted)]">Create an active goal with a monthly contribution to use the simulator.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="flex items-center gap-2 font-semibold"><Lightbulb size={19} className="text-[var(--warning)]" /> Forecast and alerts</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Compared with {summary.spending_forecast.months_analyzed} previously tracked month{summary.spending_forecast.months_analyzed === 1 ? "" : "s"}.</p></CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Historical average</p><p className="mt-2 font-semibold">{money.format(Number(summary.spending_forecast.historical_monthly_average))}</p></div><div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-xs text-[var(--text-muted)]">Forecast difference</p><p className="mt-2 font-semibold">{summary.spending_forecast.variance_percentage === null ? "Not enough data" : `${Number(summary.spending_forecast.variance_percentage) > 0 ? "+" : ""}${summary.spending_forecast.variance_percentage}%`}</p></div></div>
            {summary.spending_forecast.alerts.length ? summary.spending_forecast.alerts.map((alert) => <div key={`${alert.title}-${alert.category ?? "all"}`} className="rounded-xl border border-[var(--warning)]/30 p-4"><p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} className="text-[var(--warning)]" /> {alert.title}</p><p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">{alert.description}</p></div>) : <div className="rounded-xl border border-[var(--border)] p-4"><p className="font-semibold text-[var(--success)]">No overspending alert</p><p className="mt-1 text-sm text-[var(--text-muted)]">Keep recording expenses to improve the forecast.</p></div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="flex items-center gap-2 font-semibold"><Target size={19} className="text-[var(--brand)]" /> Goal priority and predictions</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Emergency protection and dated goals are prioritized first, followed by achievable quick wins.</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {prioritizedGoals.length ? prioritizedGoals.map((goal) => <GoalPriorityCard key={goal.goal_id} goal={goal} money={money} />) : <p className="text-sm text-[var(--text-muted)]">Create an active financial goal to receive prioritized recommendations.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">How your health score is calculated</h2><p className="mt-1 text-sm text-[var(--text-muted)]">A transparent planning indicator—not a credit score or financial guarantee.</p></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ScorePart label="Cash flow" score={summary.financial_health.cash_flow} maximum={30} />
          <ScorePart label="Spending control" score={summary.financial_health.spending_control} maximum={25} />
          <ScorePart label="Emergency readiness" score={summary.financial_health.emergency_readiness} maximum={20} />
          <ScorePart label="Goal planning" score={summary.financial_health.goal_planning} maximum={15} />
          <ScorePart label="Tracking consistency" score={summary.financial_health.tracking_consistency} maximum={10} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = "" }: { icon: typeof Gauge; label: string; value: string; detail?: string; tone?: string }) {
  return <Card className="shadow-none"><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-[var(--text-muted)]">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>{detail ? <p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p> : null}</div><span className="grid size-10 place-items-center rounded-xl bg-[var(--surface-subtle)] text-[var(--brand)]"><Icon size={19} /></span></CardContent></Card>;
}

function GoalPriorityCard({ goal, money }: { goal: GoalProjection; money: Intl.NumberFormat }) {
  return <div className="rounded-xl border border-[var(--border)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{goal.name}</h3><span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)]">Priority {goal.priority_rank}</span></div><p className="mt-2 text-sm leading-5 text-[var(--text-muted)]">{goal.priority_reason}</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-[var(--text-muted)]">Monthly plan</p><p className="mt-1 font-semibold">{money.format(Number(goal.monthly_contribution))}</p></div><div><p className="text-xs text-[var(--text-muted)]">Estimated time</p><p className="mt-1 font-semibold">{formatGoalDuration(goal.estimated_days)}</p></div></div><p className="mt-3 border-t border-[var(--border)] pt-3 text-sm text-[var(--text-muted)]">{goal.recommendation}</p></div>;
}

function ScorePart({ label, score, maximum }: { label: string; score: number; maximum: number }) {
  return <div className="rounded-xl bg-[var(--surface-subtle)] p-4"><div className="flex justify-between text-sm"><span>{label}</span><strong>{score}/{maximum}</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(score / maximum * 100, 100)}%` }} /></div></div>;
}
