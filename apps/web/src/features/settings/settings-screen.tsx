"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Bot,
  Check,
  CircleUserRound,
  Eye,
  LogOut,
  Palette,
  Save,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import type { User, UserResponse } from "@/features/auth/types";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<SettingsInput>(() => settingsFromUser(user!));
  const save = useMutation({
    mutationFn: async (input: SettingsInput) =>
      (await apiClient.put<UserResponse>("/settings", input)).data,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["auth", "me"], updatedUser);
      applyTheme(updatedUser.preferences.theme);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    },
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
        description="Manage how LifeTracker looks, calculates your month, and uses optional assistance."
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
            <div><h2 className="font-semibold">Financial preferences</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Control currency, dates, and monthly summaries.</p></div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Select label="Currency" value={form.currency_code} onChange={(event) => setForm({ ...form, currency_code: event.target.value })}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</Select>
            <Select label="Timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}>{timezones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
            <Input label="Financial month starts" type="number" min={1} max={28} hint="Choose a day from 1 to 28." value={form.financial_month_start} onChange={(event) => setForm({ ...form, financial_month_start: Number(event.target.value) })} />
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
            <div><h2 className="font-semibold">Notifications and assistance</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Optional features remain under your control.</p></div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <PreferenceToggle icon={Bell} title="Notifications" description="Allow LifeTracker reminders when notification delivery is configured." checked={form.notifications_enabled} onChange={(checked) => setForm({ ...form, notifications_enabled: checked })} />
            <PreferenceToggle icon={Bot} title="Financial AI insights" description="Allow controlled financial summaries to be used for optional AI explanations." checked={form.ai_insights_enabled} onChange={(checked) => setForm({ ...form, ai_insights_enabled: checked })} />
            <PreferenceToggle icon={Eye} title="Journal-aware insights" description="Allow confirmed journal context to support future insights. Off by default." checked={form.journal_ai_enabled} onChange={(checked) => setForm({ ...form, journal_ai_enabled: checked })} />
          </CardContent>
        </Card>
      </form>

      <Card className="mt-6 border-[color-mix(in_srgb,var(--danger)_25%,var(--border))]">
        <CardHeader className="flex-row items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] text-[var(--danger)]"><ShieldCheck size={19} /></span>
          <div><h2 className="font-semibold">Privacy and session</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Your data is isolated to this signed-in account.</p></div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Sign out when using a shared device. Account deletion and full data export should be added with password confirmation before public release.</p>
          <Button variant="danger" className="shrink-0" onClick={signOut}><LogOut size={18} /> Sign out of this device</Button>
        </CardContent>
      </Card>
    </div>
  );
}
