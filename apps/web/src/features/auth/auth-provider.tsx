"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import type { LoginInput, RegisterInput, User, UserResponse } from "./types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_QUERY_KEY = ["auth", "me"] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const authQuery = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => (await apiClient.get<UserResponse>("/auth/me")).data,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) =>
      (await apiClient.post<UserResponse>("/auth/login", input)).data,
    onSuccess: (user) => queryClient.setQueryData(AUTH_QUERY_KEY, user),
  });
  const registerMutation = useMutation({
    mutationFn: async (input: RegisterInput) =>
      (await apiClient.post<UserResponse>("/auth/register", input)).data,
    onSuccess: (user) => queryClient.setQueryData(AUTH_QUERY_KEY, user),
  });
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/auth/logout");
    },
    onSettled: () => queryClient.setQueryData(AUTH_QUERY_KEY, null),
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: authQuery.data ?? null,
      isLoading: authQuery.isLoading,
      isAuthenticated: Boolean(authQuery.data),
      login: loginMutation.mutateAsync,
      register: registerMutation.mutateAsync,
      logout: logoutMutation.mutateAsync,
      refetch: () => void authQuery.refetch(),
    }),
    [authQuery, loginMutation.mutateAsync, logoutMutation.mutateAsync, registerMutation.mutateAsync],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

