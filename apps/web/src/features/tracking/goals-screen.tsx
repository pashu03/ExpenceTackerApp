"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock3, Goal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { trackingApi } from "./api";
import type { FinancialGoal, GoalInput } from "./types";
import {
  calculateGoalPlanPreview,
  currentMonth,
  errorMessage,
  formatDate,
  formatGoalDuration,
  moneyFormatter,
} from "./utils";

const emptyGoal = (): GoalInput => ({
  name: "",
  description: "",
  target_amount: "",
  current_amount: "0",
  monthly_contribution: "0",
  target_date: "",
  status: "active",
});

export function GoalsScreen() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const money = moneyFormatter(user);
  const month = currentMonth();
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<FinancialGoal | null>(null);
  const [form, setForm] = useState<GoalInput>(emptyGoal);
  const query = useQuery({ queryKey: ["goals"], queryFn: trackingApi.goals });
  const summaryQuery = useQuery({
    queryKey: ["monthly-summary", month],
    queryFn: () => trackingApi.summary(month),
  });
  const save = useMutation({
    mutationFn: ({ input, id }: { input: GoalInput; id?: string }) => trackingApi.saveGoal(input, id),
    onSuccess: async (saved, variables) => {
      queryClient.setQueryData<FinancialGoal[]>(["goals"], (current = []) =>
        [saved, ...current.filter((item) => item.id !== saved.id)].sort((left, right) => right.created_at.localeCompare(left.created_at)),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["goals"] }),
        queryClient.invalidateQueries({ queryKey: ["monthly-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
      ]);
      showToast(variables.id ? "Goal updated." : "Goal created.");
      close();
    },
    onError: (error) => showToast(errorMessage(error), "error"),
  });
  const remove = useMutation({
    mutationFn: trackingApi.deleteGoal,
    onSuccess: async (_, id) => {
      queryClient.setQueryData<FinancialGoal[]>(["goals"], (current = []) => current.filter((item) => item.id !== id));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["goals"] }),
        queryClient.invalidateQueries({ queryKey: ["monthly-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
      ]);
      showToast("Goal deleted.");
    },
    onError: (error) => showToast(errorMessage(error), "error"),
  });

  function close() {
    setOpen(false);
    setEditing(null);
    setForm(emptyGoal());
    save.reset();
  }

  function edit(item: FinancialGoal) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      target_amount: item.target_amount,
      current_amount: item.current_amount,
      monthly_contribution: item.monthly_contribution,
      target_date: item.target_date ?? "",
      status: item.status,
    });
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const goals = query.data ?? [];
  const projections = new Map(
    (summaryQuery.data?.goal_projections ?? []).map((projection) => [projection.goal_id, projection]),
  );
  const existingContribution =
    editing?.status === "active" ? Number(editing.monthly_contribution) : 0;
  const otherGoalContributions = Math.max(
    Number(summaryQuery.data?.planned_goal_contributions ?? 0) - existingContribution,
    0,
  );
  const formPreview = calculateGoalPlanPreview({
    targetAmount: Number(form.target_amount),
    currentAmount: Number(form.current_amount),
    monthlyContribution: Number(form.monthly_contribution),
    monthlyIncome: Number(summaryQuery.data?.income ?? 0),
    monthlyExpenses: Number(summaryQuery.data?.expenses ?? 0),
    otherGoalContributions,
    isActive: form.status === "active",
  });

  return (
    <div>
      <PageHeader
        eyebrow="Your future"
        title="Financial goals"
        description="Choose how much to save each month and see when each goal could be reached."
        action={<Button onClick={() => setOpen(true)}><Plus size={18} /> Create goal</Button>}
      />
      {open ? (
        <Card className="mb-6 border-[var(--brand)]/30">
          <CardHeader>
            <h2 className="text-lg font-semibold">{editing ? "Edit goal" : "Create a financial goal"}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">A monthly contribution is a plan from your income; update “Already saved” only after you actually set money aside.</p>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate({ input: { ...form, target_date: form.target_date || null }, id: editing?.id }); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Goal name" required maxLength={120} placeholder="Emergency fund, laptop..." value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                <Input label="Target date (optional)" type="date" value={form.target_date ?? ""} onChange={(event) => setForm({ ...form, target_date: event.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Input label="Target amount" type="number" min="0.01" step="0.01" required value={form.target_amount} onChange={(event) => setForm({ ...form, target_amount: event.target.value })} />
                <Input label="Already saved" type="number" min="0" step="0.01" required value={form.current_amount} onChange={(event) => setForm({ ...form, current_amount: event.target.value })} />
                <Input label="Monthly contribution" hint="Planned amount from monthly income." type="number" min="0" step="0.01" required value={form.monthly_contribution} onChange={(event) => setForm({ ...form, monthly_contribution: event.target.value })} />
                <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as GoalInput["status"] })}>
                  <option value="active">Active</option><option value="paused">Paused</option>{editing?.status === "completed" ? <option value="completed">Completed</option> : null}
                </Select>
              </div>
              <Input label="Description (optional)" maxLength={300} placeholder="Why this goal matters" value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              {Number(form.target_amount) > 0 ? (
                <div className="rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-soft)] p-4" aria-live="polite">
                  <div className="flex items-center gap-2"><Sparkles size={17} className="text-[var(--brand)]" /><h3 className="font-semibold">Live goal estimate</h3></div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div><p className="text-xs text-[var(--text-muted)]">Amount remaining</p><p className="mt-1 font-semibold">{money.format(formPreview.remainingAmount)}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Estimated time</p><p className="mt-1 font-semibold">{formatGoalDuration(formPreview.estimatedDays)}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Affordable this month</p><p className="mt-1 font-semibold">{money.format(formPreview.recommendedContribution)}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Salary used</p><p className="mt-1 font-semibold">{formPreview.incomePercentage === null ? "Add income" : `${formPreview.incomePercentage.toFixed(1)}%`}</p></div>
                  </div>
                  <p className={`mt-3 text-sm ${formPreview.affordability === "overcommitted" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
                    {formPreview.affordability === "needs_income" && "Add this month's income to check whether the contribution is affordable."}
                    {formPreview.affordability === "not_configured" && `You can currently allocate up to ${money.format(formPreview.recommendedContribution)} after expenses and other goals.`}
                    {formPreview.affordability === "overcommitted" && `This plan is above the money available after expenses. A safer contribution is ${money.format(formPreview.recommendedContribution)} per month.`}
                    {formPreview.affordability === "on_track" && `After current expenses and all goal plans, about ${money.format(formPreview.availableAfterPlan)} remains this month.`}
                  </p>
                </div>
              ) : null}
              {save.error ? <p role="alert" className="text-sm text-[var(--danger)]">{errorMessage(save.error)}</p> : null}
              <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : editing ? "Save changes" : "Create goal"}</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}
      {query.isLoading ? <LoadingState label="Loading goals..." /> : null}
      {query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && goals.length === 0 ? <EmptyState title="No financial goals yet" description="Create a target and monthly contribution to receive a completion estimate." action={<Button onClick={() => setOpen(true)}>Create first goal</Button>} /> : null}
      {goals.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((item) => {
            const projection = projections.get(item.id);
            return (
              <Card key={item.id}>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Goal size={19} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="truncate font-semibold">{item.name}</h2><span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-xs capitalize">{item.status}</span></div>{item.description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{item.description}</p> : null}</div></div>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(Number(item.progress_percentage), 100)}%` }} /></div>
                  <div className="mt-2 flex justify-between text-sm"><span className="font-semibold">{money.format(Number(item.current_amount))} saved</span><span className="text-[var(--text-muted)]">{item.progress_percentage}%</span></div>
                  <div className="mt-4 grid gap-3 rounded-xl bg-[var(--surface-subtle)] p-4 sm:grid-cols-2">
                    <div><p className="text-xs text-[var(--text-muted)]">Monthly contribution</p><p className="mt-1 font-semibold">{money.format(Number(item.monthly_contribution))}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Estimated time</p><p className="mt-1 flex items-center gap-1.5 font-semibold"><Clock3 size={15} /> {item.status === "completed" ? "Goal completed" : item.status === "paused" ? "Paused" : formatGoalDuration(projection?.estimated_days ?? null)}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Remaining</p><p className="mt-1 font-semibold">{money.format(Number(item.remaining_amount))}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Suggested this month</p><p className="mt-1 font-semibold text-[var(--brand)]">{projection ? money.format(Number(projection.recommended_monthly_contribution)) : "—"}</p></div>
                  </div>
                  {projection ? <div className={`mt-3 rounded-xl border p-3 text-sm leading-5 ${projection.affordability_status === "overcommitted" ? "border-[var(--danger)]/30 bg-[var(--surface-subtle)] text-[var(--danger)]" : "border-[var(--brand)]/20 bg-[var(--brand-soft)] text-[var(--text-muted)]"}`}><p className="flex items-center gap-2 font-semibold text-[var(--text)]"><Sparkles size={15} /> Goal guidance</p><p className="mt-1">{projection.recommendation}</p></div> : null}
                  {item.target_date ? <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><CalendarClock size={14} /> Target {formatDate(item.target_date)}</p> : null}
                  <div className="mt-4 flex justify-end border-t border-[var(--border)] pt-3"><Button variant="ghost" onClick={() => edit(item)}><Pencil size={16} /> Edit</Button><Button variant="ghost" className="text-[var(--danger)]" onClick={() => { if (window.confirm("Delete this goal?")) remove.mutate(item.id); }}><Trash2 size={16} /> Delete</Button></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
