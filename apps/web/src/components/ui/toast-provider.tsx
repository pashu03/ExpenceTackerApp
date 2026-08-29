"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setMessages((current) => [...current.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] grid justify-items-end gap-2 sm:left-auto sm:w-96"
        aria-live="polite"
        aria-atomic="true"
      >
        {messages.map((item) => {
          const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? AlertCircle : Info;
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-xl"
            >
              <Icon
                size={19}
                className={
                  item.tone === "error"
                    ? "mt-0.5 shrink-0 text-[var(--danger)]"
                    : "mt-0.5 shrink-0 text-[var(--brand)]"
                }
              />
              <p className="min-w-0 flex-1 leading-5">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
