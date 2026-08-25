"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Goal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useAuth } from "@/features/auth/auth-provider";
import { trackingApi } from "./api";
import type { FinancialGoal, GoalInput } from "./types";
import { errorMessage, formatDate, moneyFormatter } from "./utils";

const emptyGoal = (): GoalInput => ({ name: "", description: "", target_amount: "", current_amount: "0", target_date: "", status: "active" });

export function GoalsScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const money = moneyFormatter(user);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<FinancialGoal | null>(null);
  const [form, setForm] = useState<GoalInput>(emptyGoal);
  const query = useQuery({ queryKey: ["goals"], queryFn: trackingApi.goals });
  const save = useMutation({ mutationFn: ({ input, id }: { input: GoalInput; id?: string }) => trackingApi.saveGoal(input, id), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["goals"] }), queryClient.invalidateQueries({ queryKey: ["monthly-summary"] })]); close(); } });
  const remove = useMutation({ mutationFn: trackingApi.deleteGoal, onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["goals"] }), queryClient.invalidateQueries({ queryKey: ["monthly-summary"] })]); } });

  function close() { setOpen(false); setEditing(null); setForm(emptyGoal()); save.reset(); }
  function edit(item: FinancialGoal) { setEditing(item); setForm({ name: item.name, description: item.description ?? "", target_amount: item.target_amount, current_amount: item.current_amount, target_date: item.target_date ?? "", status: item.status }); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
  const goals = query.data ?? [];

  return <div>
    <PageHeader eyebrow="Your future" title="Financial goals" description="Set a target and keep the saved amount up to date as you make progress." action={<Button onClick={() => setOpen(true)}><Plus size={18} /> Create goal</Button>} />
    {open ? <Card className="mb-6 border-[var(--brand)]/30"><CardHeader><h2 className="text-lg font-semibold">{editing ? "Edit goal" : "Create a financial goal"}</h2></CardHeader><CardContent>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate({ input: { ...form, target_date: form.target_date || null }, id: editing?.id }); }}>
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Goal name" required maxLength={120} placeholder="Emergency fund, laptop..." value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><Input label="Target date (optional)" type="date" value={form.target_date ?? ""} onChange={(event) => setForm({ ...form, target_date: event.target.value })} /></div>
        <div className="grid gap-4 sm:grid-cols-3"><Input label="Target amount" type="number" min="0.01" step="0.01" required value={form.target_amount} onChange={(event) => setForm({ ...form, target_amount: event.target.value })} /><Input label="Already saved" type="number" min="0" step="0.01" required value={form.current_amount} onChange={(event) => setForm({ ...form, current_amount: event.target.value })} /><Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as GoalInput["status"] })}><option value="active">Active</option><option value="paused">Paused</option>{editing?.status === "completed" ? <option value="completed">Completed</option> : null}</Select></div>
        <Input label="Description (optional)" maxLength={300} placeholder="Why this goal matters" value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        {save.error ? <p role="alert" className="text-sm text-[var(--danger)]">{errorMessage(save.error)}</p> : null}
        <div className="flex justify-end gap-3"><Button variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : editing ? "Save changes" : "Create goal"}</Button></div>
      </form>
    </CardContent></Card> : null}
    {query.isLoading ? <LoadingState label="Loading goals..." /> : null}{query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
    {!query.isLoading && !query.isError && goals.length === 0 ? <EmptyState title="No financial goals yet" description="Create a target for something important and track the amount you have saved." action={<Button onClick={() => setOpen(true)}>Create first goal</Button>} /> : null}
    {goals.length ? <div className="grid gap-4 md:grid-cols-2">{goals.map((item) => <Card key={item.id}><CardContent className="p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Goal size={19} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="truncate font-semibold">{item.name}</h2><span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-xs capitalize">{item.status}</span></div>{item.description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{item.description}</p> : null}</div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(Number(item.progress_percentage), 100)}%` }} /></div><div className="mt-2 flex justify-between text-sm"><span className="font-semibold">{money.format(Number(item.current_amount))} saved</span><span className="text-[var(--text-muted)]">{item.progress_percentage}%</span></div><p className="mt-3 text-sm text-[var(--text-muted)]">{money.format(Number(item.remaining_amount))} remaining</p>{item.target_date ? <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><CalendarClock size={14} /> Target {formatDate(item.target_date)}</p> : null}<div className="mt-4 flex justify-end border-t border-[var(--border)] pt-3"><Button variant="ghost" onClick={() => edit(item)}><Pencil size={16} /> Edit</Button><Button variant="ghost" className="text-[var(--danger)]" onClick={() => { if (window.confirm("Delete this goal?")) remove.mutate(item.id); }}><Trash2 size={16} /> Delete</Button></div></CardContent></Card>)}</div> : null}
  </div>;
}
