"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">Something went wrong</p>
        <h1 className="mt-2 text-3xl font-semibold">This page could not be loaded</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          Your saved data is safe. Try the request again, or return after checking your connection.
        </p>
        <Button className="mt-6" onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
