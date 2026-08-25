import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthFormShell } from "@/features/auth/auth-form-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthFormShell
      title="Welcome back"
      description="Sign in to continue understanding your money and your days."
      footer={
        <>
          New to LifeTracker?{" "}
          <Link className="font-semibold text-[var(--brand)] hover:underline" href="/signup">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="min-h-64" />}>
        <LoginForm />
      </Suspense>
    </AuthFormShell>
  );
}

