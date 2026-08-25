"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/components/ui/states";
import { useAuth } from "./auth-provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading || !isAuthenticated) return <LoadingState label="Opening your private space…" />;
  return children;
}

