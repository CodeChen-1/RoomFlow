import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { dateFromKey, localDateKey, todayKey } from "../lib/datetime";
import { Button } from "./Button";

interface DateNavigatorProps {
  value: string;
  onChange: (value: string) => void;
  showToday?: boolean;
}

export function DateNavigator({ value, onChange, showToday = true }: DateNavigatorProps) {
  const inputId = useId();

  const shift = (days: number) => {
    const date = dateFromKey(value);
    date.setDate(date.getDate() + days);
    onChange(localDateKey(date));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-xl border border-slate-300 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <label htmlFor={inputId} className="sr-only">
          Select date
        </label>
        <input
          id={inputId}
          type="date"
          value={value}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
          className="h-8 w-[9.5rem] border-0 bg-transparent px-1 text-sm font-medium text-slate-800"
        />
        <button
          type="button"
          onClick={() => shift(1)}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {showToday ? (
        <Button variant="secondary" size="sm" onClick={() => onChange(todayKey())}>
          Today
        </Button>
      ) : null}
    </div>
  );
}
