"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

function preferredTheme(): Theme {
  const stored = window.localStorage.getItem("lifetracker-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  useEffect(() => {
    const initial = preferredTheme();
    document.documentElement.dataset.theme = initial;
  }, []);

  function toggle() {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("lifetracker-theme", next);
  }

  return (
    <Button
      variant="ghost"
      className="size-11 px-0"
      onClick={toggle}
      aria-label="Toggle color theme"
    >
      <Moon size={19} className="block [[data-theme=dark]_&]:hidden" />
      <Sun size={19} className="hidden [[data-theme=dark]_&]:block" />
    </Button>
  );
}
