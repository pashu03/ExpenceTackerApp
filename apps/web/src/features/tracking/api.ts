import { apiClient } from "@/lib/api-client";
import type {
  DataResponse,
  Expense,
  ExpenseInput,
  FinancialGoal,
  GoalInput,
  Income,
  IncomeInput,
  JournalEntry,
  JournalInput,
  MonthlySummary,
} from "./types";

export const trackingApi = {
  async expenses(month: string) {
    return (await apiClient.get<DataResponse<Expense[]>>(`/expenses?month=${month}`)).data;
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
};
