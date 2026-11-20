export type Page = "dashboard" | "rooms" | "reservations";

export interface Route {
  page: Page;
  date?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(value: string | undefined): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [path, queryString = ""] = raw.split("?");
  const query = new URLSearchParams(queryString);
  const date = query.get("date") ?? undefined;
  const validDate = isValidDateKey(date) ? date : undefined;

  if (path === "rooms") return { page: "rooms", date: validDate };
  if (path === "reservations") return { page: "reservations", date: validDate };
  return { page: "dashboard", date: validDate };
}

export function pageLabel(page: Page): string {
  if (page === "rooms") return "Rooms";
  if (page === "reservations") return "Reservations";
  return "Dashboard";
}
