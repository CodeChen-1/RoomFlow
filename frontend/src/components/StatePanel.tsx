import type { ReactNode } from "react";
import { AlertTriangle, LoaderCircle, type LucideIcon } from "lucide-react";

import { Button } from "./Button";

export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  return (
    <div className="card p-8" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <LoaderCircle className="h-4 w-4 animate-spin text-teal-700" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-6 space-y-3">
        <div className="skeleton h-4 w-2/5" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-24 w-full" />
      </div>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card border-rose-200 p-6 sm:p-8" role="alert">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-950">Something needs attention</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
          {onRetry ? (
            <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
