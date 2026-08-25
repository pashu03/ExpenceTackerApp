"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "./auth-provider";

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(100),
    email: z.email("Enter a valid email address."),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    confirmPassword: z.string(),
    currency_code: z.string().length(3),
    timezone: z.string().min(1),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const { register: createAccount } = useAuth();
  const router = useRouter();
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { currency_code: "INR", timezone: detectedTimezone },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await createAccount({
        name: values.name,
        email: values.email,
        password: values.password,
        currency_code: values.currency_code,
        timezone: values.timezone,
      });
      router.replace("/dashboard");
    } catch (error) {
      setError("root", {
        message: error instanceof ApiError ? error.message : "Unable to create your account.",
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
      <Input label="Name" autoComplete="name" error={errors.name?.message} {...register("name")} />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Currency" error={errors.currency_code?.message} {...register("currency_code")}>
          <option value="INR">INR — ₹</option>
          <option value="USD">USD — $</option>
          <option value="EUR">EUR — €</option>
          <option value="GBP">GBP — £</option>
        </Select>
        <Input
          label="Timezone"
          error={errors.timezone?.message}
          readOnly
          {...register("timezone")}
        />
      </div>
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters with a letter and number."
        error={errors.password?.message}
        {...register("password")}
      />
      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" fullWidth disabled={isSubmitting} className="mt-2">
        {isSubmitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
        Create account
        {!isSubmitting ? <ArrowRight size={18} aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}
