"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useAuth } from "@/features/auth/auth-provider";
import { trackingApi } from "./api";
import type { Income, IncomeInput } from "./types";
import { currentMonth, errorMessage, formatDate, localDate, moneyFormatter } from "./utils";

const emptyIncome = (): IncomeInput => ({ amount: "", source: "Salary", description: "", received_on: localDate() });

export function IncomeScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const money = moneyFormatter(user);
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<Income | null>(null);
  const [form, setForm] = useState<IncomeInput>(emptyIncome);
  const query = useQuery({ queryKey: ["income", month], queryFn: () => trackingApi.income(month) });
  const save = useMutation({
    mutationFn: ({ input, id }: { input: IncomeInput; id?: string }) => trackingApi.saveIncome(input, id),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["income"] }), queryClient.invalidateQueries({ queryKey: ["monthly-summary"] })]);
      close();
    },
  });
  const remove = useMutation({ mutationFn: trackingApi.deleteIncome, onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["income"] }), queryClient.invalidateQueries({ queryKey: ["monthly-summary"] })]); } });

  function close() { setOpen(false); setEditing(null); setForm(emptyIncome()); save.reset(); }
  function edit(item: Income) { setEditing(item); setForm({ amount: item.amount, source: item.source, description: item.description ?? "", received_on: item.received_on }); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
  const income = query.data ?? [];
  const total = income.reduce((sum, item) => sum + Number(item.amount), 0);

  return <div>
    <PageHeader eyebrow="Money in" title="Income" description="Add salary, freelance, business, or any irregular income for the selected month." action={<Button onClick={() => setOpen(true)}><Plus size={18} /> Add income</Button>} />
    {open ? <Card className="mb-6 border-[var(--brand)]/30"><CardHeader><h2 className="text-lg font-semibold">{editing ? "Edit income" : "Add income"}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Use “Salary” as the source for your monthly salary.</p></CardHeader><CardContent>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate({ input: form, id: editing?.id }); }}>
        <div className="grid gap-4 sm:grid-cols-3"><Input label="Amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /><Input label="Income source" required maxLength={100} placeholder="Salary, Freelance..." value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /><Input label="Received date" type="date" required value={form.received_on} onChange={(event) => setForm({ ...form, received_on: event.target.value })} /></div>
        <Input label="Description (optional)" maxLength={200} placeholder="August salary, website project..." value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        {save.error ? <p role="alert" className="text-sm text-[var(--danger)]">{errorMessage(save.error)}</p> : null}
        <div className="flex justify-end gap-3"><Button variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : editing ? "Save changes" : "Add income"}</Button></div>
      </form>
    </CardContent></Card> : null}
    <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto]"><Card className="shadow-none"><CardContent className="p-5"><p className="text-sm text-[var(--text-muted)]">Total income for selected month</p><p className="mt-2 text-2xl font-semibold text-[var(--success)]">{money.format(total)}</p></CardContent></Card><div className="min-w-48"><Input label="View month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div></div>
    {query.isLoading ? <LoadingState label="Loading income..." /> : null}{query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
    {!query.isLoading && !query.isError && income.length === 0 ? <EmptyState title="No income this month" description="Add your salary or another income source to calculate monthly savings." action={<Button onClick={() => setOpen(true)}>Add income</Button>} /> : null}
    {income.length ? <Card><CardHeader><h2 className="font-semibold">Income history</h2></CardHeader><CardContent className="grid gap-2">{income.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 sm:p-4"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--success)]"><HandCoins size={18} /></span><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.source}</p><p className="text-xs text-[var(--text-muted)]">{item.description ? `${item.description} · ` : ""}{formatDate(item.received_on)}</p></div><p className="font-semibold text-[var(--success)]">+{money.format(Number(item.amount))}</p><div className="flex"><Button variant="ghost" className="size-10 px-0" onClick={() => edit(item)} aria-label="Edit income"><Pencil size={16} /></Button><Button variant="ghost" className="size-10 px-0 text-[var(--danger)]" onClick={() => { if (window.confirm("Delete this income record?")) remove.mutate(item.id); }} aria-label="Delete income"><Trash2 size={16} /></Button></div></div>)}</CardContent></Card> : null}
  </div>;
}
