"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Pencil, Plus, Trash2 } from "lucide-react";
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
import type { Budget, BudgetInput } from "./types";
import { currentMonth, errorMessage, expenseCategories, moneyFormatter } from "./utils";

function emptyBudget(month: string): BudgetInput {
  return { month, category: "Food & Dining", limit_amount: "", notes: "" };
}

export function BudgetsScreen() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const money = moneyFormatter(user);
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form, setForm] = useState<BudgetInput>(() => emptyBudget(month));
  const query = useQuery({
    queryKey: ["budgets", month],
    queryFn: () => trackingApi.budgets(month),
  });
  const save = useMutation({
    mutationFn: ({ input, id }: { input: BudgetInput; id?: string }) =>
      trackingApi.saveBudget(input, id),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["budgets"] });
      showToast(variables.id ? "Budget updated." : "Budget created.");
      closeForm();
    },
  });
  const remove = useMutation({
    mutationFn: trackingApi.deleteBudget,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["budgets"] });
      showToast("Budget deleted.");
    },
    onError: (error) => showToast(errorMessage(error), "error"),
  });

  function closeForm() {
    setOpen(false);
    setEditing(null);
    setForm(emptyBudget(month));
    save.reset();
  }

  function create() {
    setEditing(null);
    setForm(emptyBudget(month));
    setOpen(true);
  }

  function edit(item: Budget) {
    setEditing(item);
    setForm({
      month: item.month,
      category: item.category,
      limit_amount: item.limit_amount,
      notes: item.notes ?? "",
    });
    setOpen(true);
  }

  const budgets = query.data ?? [];
  const limit = budgets.reduce((sum, item) => sum + Number(item.limit_amount), 0);
  const spent = budgets.reduce((sum, item) => sum + Number(item.spent_amount), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Plan with flexibility"
        title="Monthly budgets"
        description="Set category limits and compare them with expenses you have actually recorded."
        action={
          <Button onClick={create}>
            <Plus size={18} /> Add budget
          </Button>
        }
      />

      {open ? (
        <Card className="mb-6 border-[var(--brand)]/30">
          <CardHeader>
            <h2 className="text-lg font-semibold">{editing ? "Edit budget" : "Add budget"}</h2>
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
                  label="Month"
                  type="month"
                  required
                  value={form.month}
                  onChange={(event) => setForm({ ...form, month: event.target.value })}
                />
                <Select
                  label="Category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {expenseCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </Select>
                <Input
                  label="Spending limit"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.limit_amount}
                  onChange={(event) => setForm({ ...form, limit_amount: event.target.value })}
                />
              </div>
              <Input
                label="Notes (optional)"
                maxLength={300}
                placeholder="What this budget should cover"
                value={form.notes ?? ""}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
              {save.error ? (
                <p role="alert" className="text-sm text-[var(--danger)]">
                  {errorMessage(save.error)}
                </p>
              ) : null}
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving..." : editing ? "Save changes" : "Create budget"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        {[
          ["Planned", limit],
          ["Spent", spent],
          ["Available", limit - spent],
        ].map(([label, value]) => (
          <Card key={String(label)} className="shadow-none">
            <CardContent className="p-5">
              <p className="text-sm text-[var(--text-muted)]">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{money.format(Number(value))}</p>
            </CardContent>
          </Card>
        ))}
        <div className="min-w-48">
          <Input
            label="View month"
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setForm(emptyBudget(event.target.value));
            }}
          />
        </div>
      </div>

      {query.isLoading ? <LoadingState label="Loading budgets..." /> : null}
      {query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && budgets.length === 0 ? (
        <EmptyState
          title="No budgets for this month"
          description="Add a limit for a category you want to watch. Existing expenses will be included automatically."
          action={<Button onClick={create}>Create first budget</Button>}
        />
      ) : null}
      {budgets.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {budgets.map((item) => {
            const usage = Number(item.usage_percentage);
            return (
              <Card key={item.id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                      <Gauge size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">{item.category}</h2>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {money.format(Number(item.spent_amount))} of {money.format(Number(item.limit_amount))}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                    <div
                      className={`h-full rounded-full ${usage > 100 ? "bg-[var(--danger)]" : usage >= 80 ? "bg-[var(--warning)]" : "bg-[var(--brand)]"}`}
                      style={{ width: `${Math.min(usage, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className={usage > 100 ? "font-semibold text-[var(--danger)]" : "font-semibold"}>
                      {usage}% used
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {Number(item.remaining_amount) >= 0 ? "Remaining " : "Over by "}
                      {money.format(Math.abs(Number(item.remaining_amount)))}
                    </span>
                  </div>
                  {item.notes ? <p className="mt-3 text-sm text-[var(--text-muted)]">{item.notes}</p> : null}
                  <div className="mt-4 flex justify-end border-t border-[var(--border)] pt-3">
                    <Button variant="ghost" onClick={() => edit(item)}><Pencil size={16} /> Edit</Button>
                    <Button
                      variant="ghost"
                      className="text-[var(--danger)]"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm("Delete this budget?")) remove.mutate(item.id);
                      }}
                    >
                      <Trash2 size={16} /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
