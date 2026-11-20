import { Ban, CheckCircle2, Clock3 } from "lucide-react";

import type { BookingStatus } from "../api/types";

export function StatusBadge({ status }: { status: BookingStatus }) {
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
        <Ban className="h-3 w-3" aria-hidden="true" />
        Cancelled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      Active
    </span>
  );
}

export function AvailabilityBadge({ available }: { available: boolean | null }) {
  if (available === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        Available
      </span>
    );
  }

  if (available === false) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Booked
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Clock3 className="h-3 w-3" aria-hidden="true" />
      Check a time
    </span>
  );
}
