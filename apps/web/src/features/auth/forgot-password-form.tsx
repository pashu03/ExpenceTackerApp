"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MessageResponse } from "@/features/auth/types";
import { ApiError, apiClient } from "@/lib/api-client";

const requestSchema = z.object({
  email: z
    .email("Enter a valid email address.")
    .refine((value) => value === value.toLowerCase(), "Use lowercase letters only."),
});

const resetSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type RequestValues = z.infer<typeof requestSchema>;
type ResetValues = z.infer<typeof resetSchema>;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"request" | "verify" | "complete">("request");
  const [message, setMessage] = useState<string | null>(null);
  const [developmentCode, setDevelopmentCode] = useState<string | null>(null);
  const requestForm = useForm<RequestValues>({ resolver: zodResolver(requestSchema) });
  const resetForm = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  const requestCode = requestForm.handleSubmit(async (values) => {
    try {
      requestForm.clearErrors("root");
      const response = await apiClient.post<MessageResponse>("/auth/forgot-password", values);
      setEmail(values.email);
      setMessage(response.data.message);
      setDevelopmentCode(response.data.development_code ?? null);
      setStep("verify");
    } catch (error) {
      requestForm.setError("root", {
        message: error instanceof ApiError ? error.message : "The code could not be sent.",
      });
    }
  });

  const resetPassword = resetForm.handleSubmit(async (values) => {
    try {
      resetForm.clearErrors("root");
      await apiClient.post<MessageResponse>("/auth/reset-password", {
        email,
        code: values.code,
        new_password: values.newPassword,
      });
      setStep("complete");
    } catch (error) {
      resetForm.setError("root", {
        message: error instanceof ApiError ? error.message : "The password could not be reset.",
      });
    }
  });

  if (step === "complete") {
    return (
      <div className="grid justify-items-center gap-4 py-4 text-center" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
          <CheckCircle2 size={24} />
        </span>
        <div>
          <h2 className="font-semibold">Password reset complete</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Your previous sessions were signed out. Use your new password to continue.
          </p>
        </div>
        <Link href="/login" className="w-full">
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white">
            Return to sign in
          </span>
        </Link>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <form className="grid gap-4" onSubmit={resetPassword} noValidate>
        <div role="status" className="rounded-xl bg-[var(--brand-soft)] px-4 py-3 text-sm text-[var(--brand)]">
          {message}
        </div>
        {developmentCode ? (
          <div className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">
            Development code: <strong>{developmentCode}</strong>
          </div>
        ) : null}
        {resetForm.formState.errors.root ? (
          <div role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-[var(--danger)]">
            {resetForm.formState.errors.root.message}
          </div>
        ) : null}
        <Input
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          error={resetForm.formState.errors.code?.message}
          {...resetForm.register("code")}
        />
        <Input
          label="New password"
          type="password"
          revealable
          autoComplete="new-password"
          hint="At least 8 characters with a letter and number."
          error={resetForm.formState.errors.newPassword?.message}
          {...resetForm.register("newPassword")}
        />
        <Input
          label="Confirm new password"
          type="password"
          revealable
          autoComplete="new-password"
          error={resetForm.formState.errors.confirmPassword?.message}
          {...resetForm.register("confirmPassword")}
        />
        <Button type="submit" fullWidth disabled={resetForm.formState.isSubmitting}>
          {resetForm.formState.isSubmitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
          Reset password
        </Button>
        <Button
          variant="ghost"
          fullWidth
          onClick={() => {
            setStep("request");
            setMessage(null);
            setDevelopmentCode(null);
          }}
        >
          <ArrowLeft size={17} /> Use another email
        </Button>
      </form>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={requestCode} noValidate>
      {requestForm.formState.errors.root ? (
        <div role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-[var(--danger)]">
          {requestForm.formState.errors.root.message}
        </div>
      ) : null}
      <Input
        label="Account email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@example.com"
        error={requestForm.formState.errors.email?.message}
        {...requestForm.register("email")}
      />
      <Button type="submit" fullWidth disabled={requestForm.formState.isSubmitting}>
        {requestForm.formState.isSubmitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
        Send verification code
      </Button>
    </form>
  );
}
