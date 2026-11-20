const MINUTE_MS = 60_000;

const pad = (value: number) => String(value).padStart(2, "0");

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return localDateKey(new Date());
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dayBounds(key: string): { start: Date; end: Date } {
  const start = dateFromKey(key);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function dayBoundsIso(key: string): { start: string; end: string } {
  const bounds = dayBounds(key);
  return { start: bounds.start.toISOString(), end: bounds.end.toISOString() };
}

export function formatDateTimeInput(date: Date): string {
  return `${localDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateTimeInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isoToDateTimeInput(iso: string): string {
  return formatDateTimeInput(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDateShort(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateHeading(key: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(dateFromKey(key));
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  return `${day} · ${formatTime(iso)}`;
}

export function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const range = `${formatTime(startIso)} – ${formatTime(endIso)}`;
  if (localDateKey(start) !== localDateKey(end)) {
    return `${range} · ends ${formatDateShort(end)}`;
  }
  return range;
}

export function formatClock(date: Date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / MINUTE_MS);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

export function formatHours(hours: number): string {
  return `${(Math.round(hours * 10) / 10).toFixed(1)}h`;
}

export function roundUpToNextHalfHour(date: Date): Date {
  const next = new Date(date);
  const needsRound =
    next.getSeconds() > 0 || next.getMilliseconds() > 0 || next.getMinutes() % 30 !== 0;
  next.setSeconds(0, 0);
  if (needsRound) next.setMinutes(next.getMinutes() + (30 - (next.getMinutes() % 30)));
  return next;
}

export function defaultStartForDate(dateKey: string, now: Date = new Date()): Date {
  if (dateKey <= localDateKey(now)) return roundUpToNextHalfHour(now);
  const start = dateFromKey(dateKey);
  start.setHours(9, 0, 0, 0);
  return start;
}

export function relativeDayLabel(key: string, now: Date = new Date()): string {
  if (key === localDateKey(now)) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === localDateKey(tomorrow)) return "Tomorrow";
  return formatDateHeading(key);
}

export function timezoneLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  return `Times in ${zone} (UTC${sign}${pad(hours)}:${pad(minutes)})`;
}
