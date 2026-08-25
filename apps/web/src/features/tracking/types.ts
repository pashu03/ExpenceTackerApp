export interface Expense {
  id: string;
  amount: string;
  category: string;
  description: string | null;
  notes: string | null;
  spent_on: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseInput {
  amount: string;
  category: string;
  description?: string | null;
  notes?: string | null;
  spent_on: string;
}

export interface Income {
  id: string;
  amount: string;
  source: string;
  description: string | null;
  received_on: string;
  created_at: string;
  updated_at: string;
}

export interface IncomeInput {
  amount: string;
  source: string;
  description?: string | null;
  received_on: string;
}

export interface JournalEntry {
  id: string;
  entry_date: string;
  title: string | null;
  content: string;
  mood: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalInput {
  entry_date: string;
  title?: string | null;
  content: string;
  mood?: string | null;
}

export interface FinancialGoal {
  id: string;
  name: string;
  description: string | null;
  target_amount: string;
  current_amount: string;
  target_date: string | null;
  status: "active" | "completed" | "paused";
  progress_percentage: string;
  remaining_amount: string;
  created_at: string;
  updated_at: string;
}

export interface GoalInput {
  name: string;
  description?: string | null;
  target_amount: string;
  current_amount: string;
  target_date?: string | null;
  status: "active" | "completed" | "paused";
}

export interface CategoryTotal {
  category: string;
  amount: string;
  percentage: string;
}

export interface DailyTotal {
  date: string;
  amount: string;
}

export interface SpendingSuggestion {
  type: "info" | "warning" | "opportunity" | "positive";
  title: string;
  description: string;
  potential_monthly_saving: string | null;
}

export interface MonthlySummary {
  month: string;
  income: string;
  expenses: string;
  net_savings: string;
  savings_rate: string | null;
  today_expenses: string;
  active_goals: number;
  categories: CategoryTotal[];
  daily_spending: DailyTotal[];
  recent_expenses: Expense[];
  suggestions: SpendingSuggestion[];
}

export interface DataResponse<T> {
  data: T;
}
