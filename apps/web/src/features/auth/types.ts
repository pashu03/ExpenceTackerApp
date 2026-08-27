export interface UserPreferences {
  currency_code: string;
  timezone: string;
  ai_insights_enabled: boolean;
  journal_ai_enabled: boolean;
  notifications_enabled: boolean;
  theme: "light" | "dark" | "system";
  financial_month_start: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  profile_image_url: string | null;
  created_at: string;
  preferences: UserPreferences;
}

export interface UserResponse {
  data: User;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}
