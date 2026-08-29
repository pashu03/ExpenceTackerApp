"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { trackingApi } from "./api";
import type { Income, IncomeInput } from "./types";
import { currentMonth, errorMessage, formatDate, localDate, moneyFormatter } from "./utils";

const emptyIncome = (): IncomeInput => ({ amount: "", source: "Salary", description: "", received_on: localDate() });

export function IncomeScreen() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const money = moneyFormatter(user);
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<Income | null>(null);
  const [form, setForm] = useState<IncomeInput>(emptyIncome);
  const query = useQuery({ queryKey: ["income", month], queryFn: () => trackingApi.income(month) });
  const summaryQuery = useQuery({
    queryKey: ["monthly-summary", month],
    queryFn: () => trackingApi.summary(month),
  });

  async function refreshMonthlySummary(months: Array<string | undefined>) {
    await queryClient.invalidateQueries({
      queryKey: ["monthly-summary"],
      refetchType: "none",
    });
    await Promise.all(
      [...new Set(months.filter((value): value is string => Boolean(value)))].map(async (value) => {
        await queryClient.fetchQuery({
          queryKey: ["monthly-summary", value],
          queryFn: () => trackingApi.summary(value),
        });
      }),
    );
  }

  const save = useMutation({
    mutationFn: ({ input, id }: { input: IncomeInput; id?: string }) => trackingApi.saveIncome(input, id),
    onSuccess: async (saved, variables) => {
      const savedMonth = saved.received_on.slice(0, 7);
      const previousMonth = editing?.received_on.slice(0, 7);
      if (previousMonth && previousMonth !== savedMonth) {
        queryClient.setQueryData<Income[]>(["income", previousMonth], (current = []) =>
          current.filter((item) => item.id !== saved.id),
        );
      }
      queryClient.setQueryData<Income[]>(["income", savedMonth], (current = []) =>
        [saved, ...current.filter((item) => item.id !== saved.id)].sort((left, right) =>
          right.received_on.localeCompare(left.received_on),
        ),
      );
      setMonth(savedMonth);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["income"] }),
        refreshMonthlySummary([savedMonth, previousMonth, month, currentMonth()]),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
      ]);
      showToast(variables.id ? "Income updated." : "Income added.");
      close();
    },
    onError: (error) => showToast(errorMessage(error), "error"),
  });
  const remove = useMutation({
    mutationFn: (item: Income) => trackingApi.deleteIncome(item.id),
    onSuccess: async (_, deleted) => {
      const deletedMonth = deleted.received_on.slice(0, 7);
      queryClient.setQueryData<Income[]>(["income", deletedMonth], (current = []) =>
        current.filter((item) => item.id !== deleted.id),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["income"] }),
        refreshMonthlySummary([deletedMonth, month, currentMonth()]),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
      ]);
      showToast("Income deleted.");
    },
    onError: (error) => showToast(errorMessage(error), "error"),
  });

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
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]"><Card className="shadow-none"><CardContent className="p-5"><p className="text-sm text-[var(--text-muted)]">Recorded income for selected month</p><p className="mt-2 text-2xl font-semibold text-[var(--success)]">{money.format(total)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Only income dated within {month} is included here.</p></CardContent></Card><Card className="shadow-none"><CardContent className="p-5"><p className="text-sm text-[var(--text-muted)]">Income used for planning</p><p className="mt-2 text-2xl font-semibold text-[var(--brand)]">{money.format(Number(summaryQuery.data?.planning_income ?? total))}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{summaryQuery.data?.income_basis === "latest_salary" && summaryQuery.data.latest_salary_date ? `Latest salary from ${formatDate(summaryQuery.data.latest_salary_date)} because this month's recorded total is lower.` : "Uses the selected month's recorded income."}</p></CardContent></Card><div className="min-w-48"><Input label="View month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div></div>
    {query.isLoading ? <LoadingState label="Loading income..." /> : null}{query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
    {!query.isLoading && !query.isError && income.length === 0 ? <EmptyState title="No income this month" description="Add your salary or another income source to calculate monthly savings." action={<Button onClick={() => setOpen(true)}>Add income</Button>} /> : null}
    {income.length ? <Card><CardHeader><h2 className="font-semibold">Income history</h2></CardHeader><CardContent className="grid gap-2">{income.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 sm:p-4"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--success)]"><HandCoins size={18} /></span><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.source}</p><p className="text-xs text-[var(--text-muted)]">{item.description ? `${item.description} · ` : ""}{formatDate(item.received_on)}</p></div><p className="font-semibold text-[var(--success)]">+{money.format(Number(item.amount))}</p><div className="flex"><Button variant="ghost" className="size-10 px-0" onClick={() => edit(item)} aria-label="Edit income"><Pencil size={16} /></Button><Button variant="ghost" className="size-10 px-0 text-[var(--danger)]" disabled={remove.isPending} onClick={() => { if (window.confirm("Delete this income record?")) remove.mutate(item); }} aria-label="Delete income"><Trash2 size={16} /></Button></div></div>)}</CardContent></Card> : null}
  </div>;
}
