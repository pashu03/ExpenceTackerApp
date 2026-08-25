import type { Metadata } from "next";
import Link from "next/link";
import { AuthFormShell } from "@/features/auth/auth-form-shell";
import { SignupForm } from "@/features/auth/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthFormShell
      title="Create your private space"
      description="Start with the essentials. You can add income, goals, and AI preferences later."
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-semibold text-[var(--brand)] hover:underline" href="/login">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthFormShell>
  );
}

