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
  monthly_contribution: string;
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
  monthly_contribution: string;
  target_date?: string | null;
  status: "active" | "completed" | "paused";
}

export interface Budget {
  id: string;
  month: string;
  category: string;
  limit_amount: string;
  notes: string | null;
  spent_amount: string;
  remaining_amount: string;
  usage_percentage: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetInput {
  month: string;
  category: string;
  limit_amount: string;
  notes?: string | null;
}

export interface Reminder {
  id: string;
  title: string;
  description: string | null;
  due_on: string;
  kind: "general" | "expense" | "goal" | "journal" | "income";
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReminderInput {
  title: string;
  description?: string | null;
  due_on: string;
  kind: Reminder["kind"];
  completed: boolean;
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

export interface GoalProjection {
  goal_id: string;
  name: string;
  remaining_amount: string;
  monthly_contribution: string;
  recommended_monthly_contribution: string;
  estimated_days: number | null;
  estimated_months: number | null;
  income_percentage: string | null;
  affordability_status: "on_track" | "overcommitted" | "needs_income" | "not_configured";
  recommendation: string;
}

export interface MonthlySummary {
  month: string;
  income: string;
  expenses: string;
  net_savings: string;
  savings_rate: string | null;
  available_after_expenses: string;
  planned_goal_contributions: string;
  recommended_spending_limit: string;
  today_expenses: string;
  active_goals: number;
  categories: CategoryTotal[];
  daily_spending: DailyTotal[];
  recent_expenses: Expense[];
  suggestions: SpendingSuggestion[];
  goal_projections: GoalProjection[];
}

export interface DataResponse<T> {
  data: T;
}
