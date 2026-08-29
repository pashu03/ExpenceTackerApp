"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/auth-provider";
import { trackingApi } from "./api";
import type { Expense, ExpenseInput } from "./types";
import {
  currentMonth,
  errorMessage,
  expenseCategories,
  formatDate,
  localDate,
  moneyFormatter,
} from "./utils";

const emptyExpense = (): ExpenseInput => ({
  amount: "",
  category: "Food & Dining",
  description: "",
  notes: "",
  spent_on: localDate(),
});

export function ExpensesScreen({ startOpen = false }: { startOpen?: boolean }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const money = moneyFormatter(user);
  const [month, setMonth] = useState(currentMonth());
  const [formOpen, setFormOpen] = useState(startOpen);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseInput>(emptyExpense);
  const query = useQuery({
    queryKey: ["expenses", month],
    queryFn: () => trackingApi.expenses(month),
  });
  const save = useMutation({
    mutationFn: ({ input, id }: { input: ExpenseInput; id?: string }) =>
      trackingApi.saveExpense(input, id),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["monthly-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["budgets"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
      ]);
      showToast(variables.id ? "Expense updated." : "Expense added.");
      closeForm();
    },
  });
  const remove = useMutation({
    mutationFn: trackingApi.deleteExpense,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["monthly-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["budgets"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
      ]);
      showToast("Expense deleted.");
    },
    onError: (error) => showToast(errorMessage(error), "error"),
  });

  function closeForm() {
    setEditing(null);
    setForm(emptyExpense());
    setFormOpen(false);
    save.reset();
  }

  function edit(item: Expense) {
    setEditing(item);
    setForm({
      amount: item.amount,
      category: item.category,
      description: item.description ?? "",
      notes: item.notes ?? "",
      spent_on: item.spent_on,
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const expenses = query.data ?? [];
  const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const today = expenses
    .filter((item) => item.spent_on === localDate())
    .reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Money out"
        title="Expenses"
        description="Record daily spending and see exactly where this month's money went."
        action={
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={18} /> Add expense
          </Button>
        }
      />

      {formOpen ? (
        <Card className="mb-6 border-[var(--brand)]/30">
          <CardHeader>
            <h2 className="text-lg font-semibold">{editing ? "Edit expense" : "Add expense"}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Only amount, category and date are required.</p>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate({ input: form, id: editing?.id });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Amount"
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
                <Select
                  label="Category"
                  name="category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {expenseCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </Select>
                <Input
                  label="Date"
                  name="spent_on"
                  type="date"
                  required
                  value={form.spent_on}
                  onChange={(event) => setForm({ ...form, spent_on: event.target.value })}
                />
              </div>
              <Input
                label="What was it for?"
                name="description"
                maxLength={200}
                placeholder="Dinner, cab, electricity bill..."
                value={form.description ?? ""}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
              <Textarea
                label="Notes (optional)"
                name="notes"
                maxLength={2000}
                className="min-h-24"
                value={form.notes ?? ""}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
              {save.error ? <p role="alert" className="text-sm text-[var(--danger)]">{errorMessage(save.error)}</p> : null}
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="ghost" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving..." : editing ? "Save changes" : "Add expense"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Card className="shadow-none"><CardContent className="p-5"><p className="text-sm text-[var(--text-muted)]">Today</p><p className="mt-2 text-2xl font-semibold">{money.format(today)}</p></CardContent></Card>
        <Card className="shadow-none"><CardContent className="p-5"><p className="text-sm text-[var(--text-muted)]">Selected month</p><p className="mt-2 text-2xl font-semibold">{money.format(total)}</p></CardContent></Card>
        <div className="min-w-48 self-stretch"><Input label="View month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>
      </div>

      {query.isLoading ? <LoadingState label="Loading expenses..." /> : null}
      {query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && expenses.length === 0 ? (
        <EmptyState title="No expenses this month" description="Add your first expense to start seeing daily and monthly totals." action={<Button onClick={() => setFormOpen(true)}>Add expense</Button>} />
      ) : null}
      {expenses.length > 0 ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Expense history</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{expenses.length} recorded {expenses.length === 1 ? "expense" : "expenses"}</p></CardHeader>
          <CardContent className="grid gap-2">
            {expenses.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 sm:p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><WalletCards size={18} /></span>
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.description || item.category}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.category} · {formatDate(item.spent_on)}</p></div>
                <p className="shrink-0 font-semibold">{money.format(Number(item.amount))}</p>
                <div className="flex shrink-0"><Button variant="ghost" className="size-10 px-0" onClick={() => edit(item)} aria-label="Edit expense"><Pencil size={16} /></Button><Button variant="ghost" className="size-10 px-0 text-[var(--danger)]" disabled={remove.isPending} onClick={() => { if (window.confirm("Delete this expense?")) remove.mutate(item.id); }} aria-label="Delete expense"><Trash2 size={16} /></Button></div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
