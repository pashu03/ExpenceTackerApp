import type { User } from "@/features/auth/types";

export const expenseCategories = [
  "Food & Dining",
  "Groceries",
  "Travel",
  "Fuel",
  "Rent",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Healthcare",
  "Education",
  "Family",
  "EMI / Loans",
  "Insurance",
  "Subscriptions",
  "Investments",
  "Gifts",
  "Personal Care",
  "Other",
] as const;

export function localDate(): string {
  const value = new Date();
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

export function currentMonth(): string {
  return localDate().slice(0, 7);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function moneyFormatter(user: User | null) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: user?.preferences.currency_code ?? "INR",
    maximumFractionDigits: 2,
  });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The change could not be saved.";
}
