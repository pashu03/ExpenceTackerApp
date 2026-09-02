import { apiClient } from "@/lib/api-client";
import type {
  DataResponse,
  Budget,
  BudgetInput,
  Expense,
  ExpenseInput,
  FinancialGoal,
  GoalInput,
  Income,
  IncomeInput,
  JournalEntry,
  JournalInput,
  MonthlySummary,
  Reminder,
  ReminderInput,
} from "./types";

export const trackingApi = {
  async expenses(month: string, spentOn?: string) {
    const params = new URLSearchParams({ month });
    if (spentOn) params.set("spent_on", spentOn);
    return (await apiClient.get<DataResponse<Expense[]>>(`/expenses?${params}`)).data;
  },
  async saveExpense(input: ExpenseInput, id?: string) {
    const response = id
      ? await apiClient.patch<DataResponse<Expense>>(`/expenses/${id}`, input)
      : await apiClient.post<DataResponse<Expense>>("/expenses", input);
    return response.data;
  },
  deleteExpense(id: string) {
    return apiClient.delete(`/expenses/${id}`);
  },
  async income(month: string) {
    return (await apiClient.get<DataResponse<Income[]>>(`/income?month=${month}`)).data;
  },
  async saveIncome(input: IncomeInput, id?: string) {
    const response = id
      ? await apiClient.patch<DataResponse<Income>>(`/income/${id}`, input)
      : await apiClient.post<DataResponse<Income>>("/income", input);
    return response.data;
  },
  deleteIncome(id: string) {
    return apiClient.delete(`/income/${id}`);
  },
  async journal() {
    return (await apiClient.get<DataResponse<JournalEntry[]>>("/journal")).data;
  },
  async saveJournal(input: JournalInput, id?: string) {
    const response = id
      ? await apiClient.patch<DataResponse<JournalEntry>>(`/journal/${id}`, input)
      : await apiClient.post<DataResponse<JournalEntry>>("/journal", input);
    return response.data;
  },
  deleteJournal(id: string) {
    return apiClient.delete(`/journal/${id}`);
  },
  async goals() {
    return (await apiClient.get<DataResponse<FinancialGoal[]>>("/goals")).data;
  },
  async saveGoal(input: GoalInput, id?: string) {
    const response = id
      ? await apiClient.patch<DataResponse<FinancialGoal>>(`/goals/${id}`, input)
      : await apiClient.post<DataResponse<FinancialGoal>>("/goals", input);
    return response.data;
  },
  deleteGoal(id: string) {
    return apiClient.delete(`/goals/${id}`);
  },
  async summary(month: string) {
    return (
      await apiClient.get<DataResponse<MonthlySummary>>(`/dashboard/summary?month=${month}`)
    ).data;
  },
  async analytics(month: string) {
    return (
      await apiClient.get<DataResponse<MonthlySummary>>(`/analytics/monthly?month=${month}`)
    ).data;
  },
  async budgets(month: string) {
    return (await apiClient.get<DataResponse<Budget[]>>(`/budgets?month=${month}`)).data;
  },
  async saveBudget(input: BudgetInput, id?: string) {
    const response = id
      ? await apiClient.patch<DataResponse<Budget>>(`/budgets/${id}`, input)
      : await apiClient.post<DataResponse<Budget>>("/budgets", input);
    return response.data;
  },
  deleteBudget(id: string) {
    return apiClient.delete(`/budgets/${id}`);
  },
  async reminders(month?: string) {
    const suffix = month ? `?month=${month}` : "";
    return (await apiClient.get<DataResponse<Reminder[]>>(`/reminders${suffix}`)).data;
  },
  async saveReminder(input: Partial<ReminderInput>, id?: string) {
    const response = id
      ? await apiClient.patch<DataResponse<Reminder>>(`/reminders/${id}`, input)
      : await apiClient.post<DataResponse<Reminder>>("/reminders", input);
    return response.data;
  },
  deleteReminder(id: string) {
    return apiClient.delete(`/reminders/${id}`);
  },
};
