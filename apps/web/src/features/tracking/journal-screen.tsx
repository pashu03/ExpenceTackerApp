"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookHeart, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { trackingApi } from "./api";
import type { JournalEntry, JournalInput } from "./types";
import { errorMessage, formatDate, localDate } from "./utils";

const moods = ["Happy", "Calm", "Okay", "Tired", "Stressed", "Sad", "Excited"];
const emptyJournal = (): JournalInput => ({ entry_date: localDate(), title: "", content: "", mood: "Okay" });

export function JournalScreen() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [form, setForm] = useState<JournalInput>(emptyJournal);
  const query = useQuery({ queryKey: ["journal"], queryFn: trackingApi.journal });
  const save = useMutation({
    mutationFn: ({ input, id }: { input: JournalInput; id?: string }) => trackingApi.saveJournal(input, id),
    onSuccess: async (_, variables) => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["journal"] }), queryClient.invalidateQueries({ queryKey: ["calendar"] })]); showToast(variables.id ? "Journal entry updated." : "Journal entry saved."); close(); },
  });
  const remove = useMutation({ mutationFn: trackingApi.deleteJournal, onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["journal"] }), queryClient.invalidateQueries({ queryKey: ["calendar"] })]); showToast("Journal entry deleted."); }, onError: (error) => showToast(errorMessage(error), "error") });

  function close() { setEditing(null); setForm(emptyJournal()); setOpen(false); save.reset(); }
  function edit(item: JournalEntry) { setEditing(item); setForm({ entry_date: item.entry_date, title: item.title ?? "", content: item.content, mood: item.mood ?? "Okay" }); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
  const entries = query.data ?? [];

  return <div>
    <PageHeader eyebrow="Your private space" title="My Day" description="Write one personal journal entry for each day. You can return and edit it anytime." action={!open ? <Button onClick={() => setOpen(true)}><Plus size={18} /> Write entry</Button> : undefined} />
    {open ? <Card className="mb-6 border-[var(--brand)]/30"><CardHeader><h2 className="text-lg font-semibold">{editing ? "Edit journal entry" : form.entry_date === localDate() ? "Write about today" : "Write journal entry"}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">This journal is separate from your financial records.</p></CardHeader><CardContent>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate({ input: form, id: editing?.id }); }}>
        <div className="grid gap-4 sm:grid-cols-3"><Input label="Date" type="date" required value={form.entry_date} onChange={(event) => setForm({ ...form, entry_date: event.target.value })} /><Input label="Title (optional)" maxLength={120} placeholder="A memorable day" value={form.title ?? ""} onChange={(event) => setForm({ ...form, title: event.target.value })} /><Select label="Mood" value={form.mood ?? "Okay"} onChange={(event) => setForm({ ...form, mood: event.target.value })}>{moods.map((mood) => <option key={mood}>{mood}</option>)}</Select></div>
        <Textarea label="What happened?" required maxLength={10000} placeholder="What did you do, who did you meet, and how did you feel?" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
        {save.error ? <p role="alert" className="text-sm text-[var(--danger)]">{errorMessage(save.error)}</p> : null}
        <div className="flex justify-end gap-3"><Button variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : editing ? "Save changes" : "Save journal"}</Button></div>
      </form>
    </CardContent></Card> : null}
    {query.isLoading ? <LoadingState label="Loading journal..." /> : null}{query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
    {!query.isLoading && !query.isError && entries.length === 0 ? <EmptyState title="Your journal is empty" description="Write a few lines about today. Small entries are enough." action={<Button onClick={() => setOpen(true)}>Write today&apos;s entry</Button>} /> : null}
    {entries.length ? <div className="grid gap-4"><h2 className="font-semibold">Past entries</h2>{entries.map((item) => <Card key={item.id}><CardContent className="p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><BookHeart size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title || formatDate(item.entry_date)}</h3>{item.mood ? <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-xs">{item.mood}</span> : null}</div><p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(item.entry_date)}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--text-muted)]">{item.content}</p></div><div className="flex"><Button variant="ghost" className="size-10 px-0" onClick={() => edit(item)} aria-label="Edit journal entry"><Pencil size={16} /></Button><Button variant="ghost" className="size-10 px-0 text-[var(--danger)]" onClick={() => { if (window.confirm("Delete this journal entry?")) remove.mutate(item.id); }} aria-label="Delete journal entry"><Trash2 size={16} /></Button></div></div></CardContent></Card>)}</div> : null}
  </div>;
}
