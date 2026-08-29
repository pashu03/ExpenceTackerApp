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

export function dateForTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatGoalDuration(days: number | null): string {
  if (days === null) return "Set a monthly contribution to calculate";
  if (days <= 0) return "Goal completed";
  if (days < 61) return `About ${days} day${days === 1 ? "" : "s"}`;
  const months = Math.ceil(days / 30.44);
  if (months < 24) return `About ${months} months`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `About ${years} year${years === 1 ? "" : "s"}${remainingMonths ? ` ${remainingMonths} month${remainingMonths === 1 ? "" : "s"}` : ""}`;
}

interface GoalPlanPreviewInput {
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  otherGoalContributions: number;
  isActive: boolean;
}

export interface GoalPlanPreview {
  remainingAmount: number;
  estimatedDays: number | null;
  estimatedMonths: number | null;
  incomePercentage: number | null;
  recommendedContribution: number;
  totalGoalContributions: number;
  expenseCeiling: number;
  availableAfterPlan: number;
  affordability: "on_track" | "overcommitted" | "needs_income" | "not_configured";
}

const validAmount = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

export function calculateGoalPlanPreview(input: GoalPlanPreviewInput): GoalPlanPreview {
  const target = validAmount(input.targetAmount);
  const current = validAmount(input.currentAmount);
  const contribution = validAmount(input.monthlyContribution);
  const income = validAmount(input.monthlyIncome);
  const expenses = validAmount(input.monthlyExpenses);
  const otherContributions = validAmount(input.otherGoalContributions);
  const plannedContribution = input.isActive ? contribution : 0;
  const remainingAmount = Math.max(target - current, 0);
  const availableAfterExpenses = Math.max(income - expenses, 0);
  const availableForGoal = Math.max(availableAfterExpenses - otherContributions, 0);
  const totalGoalContributions = otherContributions + plannedContribution;
  const proportionalContribution =
    contribution > 0 && totalGoalContributions > availableAfterExpenses && totalGoalContributions > 0
      ? (contribution * availableAfterExpenses) / totalGoalContributions
      : contribution;
  const recommendedContribution = Math.min(
    remainingAmount,
    contribution > 0 ? proportionalContribution : availableForGoal,
  );
  const exactMonths = contribution > 0 && remainingAmount > 0 ? remainingAmount / contribution : 0;

  let affordability: GoalPlanPreview["affordability"] = "on_track";
  if (income <= 0) affordability = "needs_income";
  else if (contribution <= 0) affordability = "not_configured";
  else if (totalGoalContributions > availableAfterExpenses) affordability = "overcommitted";

  return {
    remainingAmount,
    estimatedDays:
      remainingAmount <= 0 && target > 0
        ? 0
        : exactMonths > 0
          ? Math.ceil(exactMonths * 30.44)
          : null,
    estimatedMonths:
      remainingAmount <= 0 && target > 0 ? 0 : exactMonths > 0 ? Math.ceil(exactMonths) : null,
    incomePercentage: income > 0 ? (contribution / income) * 100 : null,
    recommendedContribution,
    totalGoalContributions,
    expenseCeiling: Math.max(income - totalGoalContributions, 0),
    availableAfterPlan: Math.max(availableAfterExpenses - totalGoalContributions, 0),
    affordability,
  };
}

export interface WhatIfResult {
  currentMonths: number | null;
  improvedMonths: number | null;
  monthsEarlier: number;
}

export function calculateWhatIf(
  remainingAmount: number,
  currentContribution: number,
  extraMonthlySaving: number,
): WhatIfResult {
  const remaining = validAmount(remainingAmount);
  const contribution = validAmount(currentContribution);
  const extra = validAmount(extraMonthlySaving);
  const currentMonths = contribution > 0 ? Math.ceil(remaining / contribution) : null;
  const improvedMonths = contribution + extra > 0 ? Math.ceil(remaining / (contribution + extra)) : null;
  return {
    currentMonths,
    improvedMonths,
    monthsEarlier:
      currentMonths !== null && improvedMonths !== null
        ? Math.max(currentMonths - improvedMonths, 0)
        : 0,
  };
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
