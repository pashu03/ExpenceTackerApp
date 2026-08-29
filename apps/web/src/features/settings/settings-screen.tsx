"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  CircleUserRound,
  Download,
  KeyRound,
  LogOut,
  Palette,
  Save,
  ShieldCheck,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { useAuth } from "@/features/auth/auth-provider";
import type { MessageResponse, User, UserResponse } from "@/features/auth/types";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/features/tracking/utils";

interface SettingsInput {
  name: string;
  currency_code: string;
  timezone: string;
  financial_month_start: number;
  notifications_enabled: boolean;
  ai_insights_enabled: boolean;
  journal_ai_enabled: boolean;
  theme: "light" | "dark" | "system";
}

const currencies = ["INR", "USD", "EUR", "GBP", "AED", "CAD", "AUD", "SGD", "JPY"];
const timezones = [
  ["Asia/Kolkata", "India (Kolkata)"],
  ["Asia/Dubai", "UAE (Dubai)"],
  ["Asia/Singapore", "Singapore"],
  ["Europe/London", "United Kingdom (London)"],
  ["America/New_York", "United States (New York)"],
  ["America/Los_Angeles", "United States (Los Angeles)"],
  ["Australia/Sydney", "Australia (Sydney)"],
] as const;

function settingsFromUser(user: User): SettingsInput {
  return {
    name: user.name,
    currency_code: user.preferences.currency_code,
    timezone: user.preferences.timezone,
    financial_month_start: user.preferences.financial_month_start,
    notifications_enabled: user.preferences.notifications_enabled,
    ai_insights_enabled: user.preferences.ai_insights_enabled,
    journal_ai_enabled: user.preferences.journal_ai_enabled,
    theme: user.preferences.theme,
  };
}

function PreferenceToggle({
  checked,
  onChange,
  icon: Icon,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-[var(--border)] p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-1 h-7 w-12 shrink-0 rounded-full transition",
          checked ? "bg-[var(--brand)]" : "bg-[var(--border)]",
        )}
      >
        <span
          className={cn(
            "absolute top-1 grid size-5 place-items-center rounded-full bg-white shadow-sm transition-all",
            checked ? "left-6" : "left-1",
          )}
        >
          {checked ? <Check size={12} className="text-[var(--brand)]" /> : null}
        </span>
      </button>
    </div>
  );
}

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<SettingsInput>(() => settingsFromUser(user!));
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [deleteForm, setDeleteForm] = useState({ password: "", confirmation: "" });
  const save = useMutation({
    mutationFn: async (input: SettingsInput) =>
      (await apiClient.put<UserResponse>("/settings", input)).data,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["auth", "me"], updatedUser);
      applyTheme(updatedUser.preferences.theme);
      setSaved(true);
      showToast("Settings saved.");
      window.setTimeout(() => setSaved(false), 3000);
    },
    onError: (error) => showToast(errorMessage(error), "error"),
  });
  const changePassword = useMutation({
    mutationFn: () => apiClient.post<MessageResponse>("/auth/change-password", {
      current_password: passwords.current,
      new_password: passwords.next,
    }),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login?passwordChanged=true");
    },
  });
  const deleteAccount = useMutation({
    mutationFn: () => apiClient.post<MessageResponse>("/auth/delete-account", deleteForm),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login?accountDeleted=true");
    },
  });
  const exportData = useMutation({
    mutationFn: () => apiClient.get<{ data: Record<string, unknown> }>("/settings/export"),
    onSuccess: (response) => {
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lifetracker-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Your data export was downloaded.");
    },
    onError: (error) => showToast(errorMessage(error), "error"),
  });

  if (!user) return null;

  function applyTheme(theme: SettingsInput["theme"]) {
    if (theme === "system") {
      window.localStorage.removeItem("lifetracker-theme");
      document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      return;
    }
    window.localStorage.setItem("lifetracker-theme", theme);
    document.documentElement.dataset.theme = theme;
  }

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Your account"
        title="Settings"
        description="Manage your profile, preferences, privacy, and account security."
        action={
          <Button type="submit" form="settings-form" disabled={save.isPending}>
            <Save size={17} /> {save.isPending ? "Saving..." : "Save changes"}
          </Button>
        }
      />

      <form
        id="settings-form"
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(false);
          save.mutate(form);
        }}
      >
        {saved ? (
          <div role="status" className="flex items-center gap-2 rounded-xl bg-[var(--brand-soft)] px-4 py-3 text-sm font-medium text-[var(--brand)]">
            <Check size={17} /> Your settings have been saved.
          </div>
        ) : null}
        {save.error ? (
          <div role="alert" className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] px-4 py-3 text-sm text-[var(--danger)]">
            {save.error instanceof Error ? save.error.message : "Settings could not be saved."}
          </div>
        ) : null}

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><CircleUserRound size={19} /></span>
            <div><h2 className="font-semibold">Profile</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">The name shown across your private workspace.</p></div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Input label="Your name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Input label="Email" value={user.email} disabled hint="Email changes require verification and are not enabled yet." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><WalletCards size={19} /></span>
            <div><h2 className="font-semibold">Financial preferences</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Control the currency and timezone used throughout the app.</p></div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Select label="Currency" value={form.currency_code} onChange={(event) => setForm({ ...form, currency_code: event.target.value })}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</Select>
            <Select label="Timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}>{timezones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Palette size={19} /></span>
            <div><h2 className="font-semibold">Appearance</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Choose a comfortable theme for every visit.</p></div>
          </CardHeader>
          <CardContent>
            <Select label="Color theme" className="max-w-sm" value={form.theme} onChange={(event) => setForm({ ...form, theme: event.target.value as SettingsInput["theme"] })}><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Bell size={19} /></span>
            <div><h2 className="font-semibold">Reminders</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Choose whether due reminders appear on your dashboard.</p></div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <PreferenceToggle icon={Bell} title="Dashboard reminders" description="Show incomplete reminders that are due today or overdue when you open LifeTracker." checked={form.notifications_enabled} onChange={(checked) => setForm({ ...form, notifications_enabled: checked })} />
          </CardContent>
        </Card>
      </form>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><KeyRound size={19} /></span>
          <div><h2 className="font-semibold">Change password</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Changing it signs out every active device for your security.</p></div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => {
            event.preventDefault();
            if (passwords.next !== passwords.confirm) return;
            changePassword.mutate();
          }}>
            <Input label="Current password" type="password" revealable required autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} />
            <Input label="New password" type="password" revealable required minLength={8} maxLength={128} autoComplete="new-password" hint="At least 8 characters with a letter and number." value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} />
            <Input label="Confirm new password" type="password" revealable required autoComplete="new-password" error={passwords.confirm && passwords.next !== passwords.confirm ? "Passwords do not match." : undefined} value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} />
            {changePassword.error ? <p role="alert" className="text-sm text-[var(--danger)] sm:col-span-3">{errorMessage(changePassword.error)}</p> : null}
            <div className="sm:col-span-3"><Button type="submit" disabled={changePassword.isPending || passwords.next !== passwords.confirm || !/[A-Za-z]/.test(passwords.next) || !/\d/.test(passwords.next)}>{changePassword.isPending ? "Changing password..." : "Change password"}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><ShieldCheck size={19} /></span><div><h2 className="font-semibold">Privacy and data</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Download a private copy of the information stored in your account.</p></div></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row"><Button variant="secondary" disabled={exportData.isPending} onClick={() => exportData.mutate()}><Download size={18} /> {exportData.isPending ? "Preparing export..." : "Download my data"}</Button><Button variant="secondary" onClick={signOut}><LogOut size={20} /> Sign out of this device</Button></CardContent>
      </Card>

      <Card className="mt-6 border-[color-mix(in_srgb,var(--danger)_25%,var(--border))]">
        <CardHeader className="flex-row items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] text-[var(--danger)]"><Trash2 size={19} /></span><div><h2 className="font-semibold">Delete account</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Permanently delete your profile and all LifeTracker data. This cannot be undone.</p></div></CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); if (window.confirm("Permanently delete your LifeTracker account and all data?")) deleteAccount.mutate(); }}>
            <Input label="Password" type="password" revealable required autoComplete="current-password" value={deleteForm.password} onChange={(event) => setDeleteForm({ ...deleteForm, password: event.target.value })} />
            <Input label='Type "DELETE" to confirm' required pattern="DELETE" value={deleteForm.confirmation} onChange={(event) => setDeleteForm({ ...deleteForm, confirmation: event.target.value })} />
            <Button variant="danger" type="submit" disabled={deleteAccount.isPending || deleteForm.confirmation !== "DELETE"}>{deleteAccount.isPending ? "Deleting..." : "Delete account"}</Button>
            {deleteAccount.error ? <p role="alert" className="text-sm text-[var(--danger)] sm:col-span-3">{errorMessage(deleteAccount.error)}</p> : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
