import { describe, expect, it } from "vitest";

import {
  addMinutes,
  dateFromKey,
  dayBounds,
  defaultStartForDate,
  formatDateTimeInput,
  formatDuration,
  formatTimeRange,
  isoToDateTimeInput,
  localDateKey,
  minutesBetween,
  parseDateTimeInput,
  relativeDayLabel,
  roundUpToNextHalfHour,
  timezoneLabel,
} from "./datetime";

function localDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

describe("local date helpers", () => {
  it("round-trips local date keys without a timezone shift", () => {
    const date = localDate(2026, 11, 19, 14, 30);

    expect(localDateKey(date)).toBe("2026-11-19");
    expect(localDateKey(dateFromKey("2026-11-19"))).toBe("2026-11-19");
  });

  it("builds half-open local day bounds", () => {
    const bounds = dayBounds("2026-11-19");

    expect(localDateKey(bounds.start)).toBe("2026-11-19");
    expect(bounds.start.getHours()).toBe(0);
    expect(bounds.start.getMinutes()).toBe(0);
    expect(localDateKey(bounds.end)).toBe("2026-11-20");
    expect(bounds.end.getTime() - bounds.start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("formats and parses datetime-local values locally", () => {
    const date = localDate(2026, 11, 19, 9, 5);
    const value = formatDateTimeInput(date);

    expect(value).toBe("2026-11-19T09:05");
    expect(localDateKey(parseDateTimeInput(value) as Date)).toBe("2026-11-19");
    expect(isoToDateTimeInput(date.toISOString())).toBe(value);
    expect(parseDateTimeInput("not-a-date")).toBeNull();
    expect(parseDateTimeInput("")).toBeNull();
  });
});

describe("time window helpers", () => {
  it("adds minutes and measures ranges", () => {
    const start = localDate(2026, 11, 19, 9);
    const end = addMinutes(start, 90);

    expect(end.getHours()).toBe(10);
    expect(end.getMinutes()).toBe(30);
    expect(minutesBetween(start.toISOString(), end.toISOString())).toBe(90);
  });

  it("rounds up to the next half hour", () => {
    expect(formatDateTimeInput(roundUpToNextHalfHour(localDate(2026, 11, 19, 10, 0)))).toBe(
      "2026-11-19T10:00",
    );
    expect(formatDateTimeInput(roundUpToNextHalfHour(localDate(2026, 11, 19, 10, 1)))).toBe(
      "2026-11-19T10:30",
    );
    expect(formatDateTimeInput(roundUpToNextHalfHour(localDate(2026, 11, 19, 10, 30)))).toBe(
      "2026-11-19T10:30",
    );
    expect(formatDateTimeInput(roundUpToNextHalfHour(localDate(2026, 11, 19, 23, 50)))).toBe(
      "2026-11-20T00:00",
    );
  });

  it("chooses a sensible default start for today and future dates", () => {
    const now = localDate(2026, 11, 19, 10, 5);

    expect(formatDateTimeInput(defaultStartForDate("2026-11-19", now))).toBe(
      "2026-11-19T10:30",
    );
    expect(formatDateTimeInput(defaultStartForDate("2026-11-20", now))).toBe(
      "2026-11-20T09:00",
    );
    expect(formatDateTimeInput(defaultStartForDate("2026-11-18", now))).toBe(
      "2026-11-19T10:30",
    );
  });

  it("formats short durations and cross-day ranges", () => {
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");

    const start = localDate(2026, 11, 19, 23, 30);
    const end = localDate(2026, 11, 20, 0, 30);
    expect(formatTimeRange(start.toISOString(), end.toISOString())).toContain("ends");
  });

  it("labels today and tomorrow relative to a supplied clock", () => {
    const now = localDate(2026, 11, 19, 10);

    expect(relativeDayLabel("2026-11-19", now)).toBe("Today");
    expect(relativeDayLabel("2026-11-20", now)).toBe("Tomorrow");
    expect(relativeDayLabel("2026-11-21", now)).not.toBe("Tomorrow");
  });

  it("describes the active timezone", () => {
    const label = timezoneLabel();
    expect(label).toContain("UTC");
    expect(label.length).toBeGreaterThan(8);
  });
});
