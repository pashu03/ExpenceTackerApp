"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, BookHeart, Check, CircleDollarSign, Goal, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { trackingApi } from "./api";
import type { Reminder, ReminderInput } from "./types";
import { currentMonth, errorMessage, formatDate, moneyFormatter } from "./utils";

type CalendarItem = {
  id: string;
  date: string;
  title: string;
  detail: string;
  tone: string;
  icon: typeof BellRing;
  reminder?: Reminder;
};

function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

function emptyReminder(): ReminderInput {
  return { title: "", description: "", due_on: today(), kind: "general", completed: false };
}

export function CalendarScreen() {
  const { user } = useAuth();
  const money = moneyFormatter(user);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [form, setForm] = useState<ReminderInput>(emptyReminder);

  const query = useQuery({
    queryKey: ["calendar", month],
    queryFn: async () => {
      const [expenses, income, journal, goals, reminders] = await Promise.all([
        trackingApi.expenses(month),
        trackingApi.income(month),
        trackingApi.journal(),
        trackingApi.goals(),
        trackingApi.reminders(month),
      ]);
      return { expenses, income, journal, goals, reminders };
    },
  });

  const save = useMutation({
    mutationFn: ({ input, id }: { input: Partial<ReminderInput>; id?: string }) =>
      trackingApi.saveReminder(input, id),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
      showToast(variables.id ? "Reminder updated." : "Reminder created.");
      closeForm();
    },
  });
  const remove = useMutation({
    mutationFn: trackingApi.deleteReminder,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
      showToast("Reminder deleted.");
    },
    onError: (error) => showToast(errorMessage(error), "error"),
  });

  const items = useMemo(() => {
    const data = query.data;
    if (!data) return [];
    const result: CalendarItem[] = [
      ...data.expenses.map((item) => ({
        id: `expense-${item.id}`,
        date: item.spent_on,
        title: item.description || item.category,
        detail: `Expense · ${money.format(Number(item.amount))}`,
        tone: "text-[var(--danger)]",
        icon: WalletCards,
      })),
      ...data.income.map((item) => ({
        id: `income-${item.id}`,
        date: item.received_on,
        title: item.source,
        detail: `Income · ${money.format(Number(item.amount))}`,
        tone: "text-[var(--success)]",
        icon: CircleDollarSign,
      })),
      ...data.journal
        .filter((item) => item.entry_date.startsWith(month))
        .map((item) => ({
          id: `journal-${item.id}`,
          date: item.entry_date,
          title: item.title || "Journal entry",
          detail: item.mood ? `Journal · ${item.mood}` : "Journal",
          tone: "text-[var(--brand)]",
          icon: BookHeart,
        })),
      ...data.goals
        .filter((item) => item.target_date?.startsWith(month))
        .map((item) => ({
          id: `goal-${item.id}`,
          date: item.target_date!,
          title: item.name,
          detail: `Goal due · ${item.progress_percentage}% funded`,
          tone: "text-[var(--warning)]",
          icon: Goal,
        })),
      ...data.reminders.map((item) => ({
        id: `reminder-${item.id}`,
        date: item.due_on,
        title: item.title,
        detail: item.completed ? "Reminder · Completed" : `Reminder · ${item.kind}`,
        tone: item.completed ? "text-[var(--text-muted)]" : "text-[var(--brand)]",
        icon: BellRing,
        reminder: item,
      })),
    ];
    return result.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  }, [month, money, query.data]);

  const grouped = useMemo(
    () => Object.entries(Object.groupBy(items, (item) => item.date)),
    [items],
  );

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyReminder());
    save.reset();
  }

  function editReminder(item: Reminder) {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      due_on: item.due_on,
      kind: item.kind,
      completed: item.completed,
    });
    setFormOpen(true);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Your month at a glance"
        title="Calendar"
        description="See transactions, journal entries, goal dates, and reminders in one chronological view."
        action={<Button onClick={() => setFormOpen(true)}><Plus size={18} /> Add reminder</Button>}
      />

      {formOpen ? (
        <Card className="mb-6 border-[var(--brand)]/30">
          <CardHeader><h2 className="text-lg font-semibold">{editing ? "Edit reminder" : "Add reminder"}</h2></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate({ input: form, id: editing?.id }); }}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Title" required minLength={1} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                <Input label="Due date" type="date" required value={form.due_on} onChange={(event) => setForm({ ...form, due_on: event.target.value })} />
                <Select label="Type" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as ReminderInput["kind"] })}>
                  <option value="general">General</option><option value="expense">Expense</option><option value="income">Income</option><option value="goal">Goal</option><option value="journal">Journal</option>
                </Select>
              </div>
              <Textarea label="Notes (optional)" rows={3} maxLength={500} value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              {save.error ? <p role="alert" className="text-sm text-[var(--danger)]">{errorMessage(save.error)}</p> : null}
              <div className="flex justify-end gap-3"><Button variant="ghost" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : editing ? "Save changes" : "Create reminder"}</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 max-w-56"><Input label="View month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>
      {query.isLoading ? <LoadingState label="Loading your calendar..." /> : null}
      {query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && !items.length ? <EmptyState title="Nothing scheduled this month" description="Transactions, journal entries, goal target dates, and reminders will appear here." action={<Button onClick={() => setFormOpen(true)}>Add a reminder</Button>} /> : null}
      {grouped.length ? <div className="grid gap-4">{grouped.map(([date, dayItems]) => (
        <Card key={date}>
          <CardHeader className="border-b border-[var(--border)]"><h2 className="font-semibold">{formatDate(date)}</h2></CardHeader>
          <CardContent className="divide-y divide-[var(--border)] p-0">{dayItems?.map((item) => { const Icon = item.icon; return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-subtle)] ${item.tone}`}><Icon size={17} /></span>
              <div className="min-w-0 flex-1"><p className={item.reminder?.completed ? "truncate text-sm line-through text-[var(--text-muted)]" : "truncate text-sm font-medium"}>{item.title}</p><p className="mt-0.5 text-xs capitalize text-[var(--text-muted)]">{item.detail}</p></div>
              {item.reminder ? <div className="flex shrink-0">
                <Button variant="ghost" className="size-10 px-0" title={item.reminder.completed ? "Mark incomplete" : "Mark complete"} aria-label={item.reminder.completed ? "Mark reminder incomplete" : "Mark reminder complete"} onClick={() => save.mutate({ input: { completed: !item.reminder!.completed }, id: item.reminder!.id })}><Check size={17} /></Button>
                <Button variant="ghost" className="size-10 px-0" aria-label="Edit reminder" onClick={() => editReminder(item.reminder!)}><Pencil size={16} /></Button>
                <Button variant="ghost" className="size-10 px-0 text-[var(--danger)]" aria-label="Delete reminder" disabled={remove.isPending} onClick={() => { if (window.confirm("Delete this reminder?")) remove.mutate(item.reminder!.id); }}><Trash2 size={16} /></Button>
              </div> : null}
            </div>
          ); })}</CardContent>
        </Card>
      ))}</div> : null}
    </div>
  );
}
