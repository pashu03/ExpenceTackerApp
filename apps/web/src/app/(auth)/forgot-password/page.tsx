import type { Metadata } from "next";
import Link from "next/link";
import { AuthFormShell } from "@/features/auth/auth-form-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthFormShell
      title="Reset your password"
      description="We will send a short-lived verification code to your account email."
      footer={
        <Link className="font-semibold text-[var(--brand)] hover:underline" href="/login">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthFormShell>
  );
}
