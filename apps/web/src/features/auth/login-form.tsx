"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "./auth-provider";

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const safeReturnTo = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const submit = handleSubmit(async (values) => {
    try {
      await login(values);
      router.replace(safeReturnTo);
    } catch (error) {
      setError("root", {
        message: error instanceof ApiError ? error.message : "Unable to sign in. Try again.",
      });
    }
  });

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      {errors.root ? (
        <div role="alert" className="rounded-xl bg-red-500/10 px-3.5 py-3 text-sm text-[var(--danger)]">
          {errors.root.message}
        </div>
      ) : null}
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="Your password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" fullWidth disabled={isSubmitting} className="mt-2">
        {isSubmitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
        Sign in
        {!isSubmitting ? <ArrowRight size={18} aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}

