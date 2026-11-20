import { describe, expect, it } from "vitest";

import { addMinutes, formatDateTimeInput, localDateKey } from "./datetime";
import {
  createInitialValues,
  hasErrors,
  validateBooking,
  type BookingFormValues,
} from "./validation";

const NOW = new Date(2035, 0, 15, 9, 0, 0, 0);
const START = new Date(2035, 0, 15, 10, 0, 0, 0);

function values(overrides: Partial<BookingFormValues> = {}): BookingFormValues {
  return {
    title: "Product planning",
    organiser: "Alex Morgan",
    roomId: "1",
    start: formatDateTimeInput(START),
    end: formatDateTimeInput(addMinutes(START, 60)),
    ...overrides,
  };
}

describe("validateBooking", () => {
  it("accepts a complete future reservation", () => {
    expect(validateBooking(values(), NOW)).toEqual({});
  });

  it("requires a title and organiser", () => {
    const errors = validateBooking(values({ title: " ", organiser: "" }), NOW);

    expect(errors.title).toBeTruthy();
    expect(errors.organiser).toBeTruthy();
    expect(hasErrors(errors)).toBe(true);
  });

  it("limits title and organiser lengths", () => {
    const errors = validateBooking(
      values({ title: "x".repeat(161), organiser: "y".repeat(101) }),
      NOW,
    );

    expect(errors.title).toContain("160");
    expect(errors.organiser).toContain("100");
  });

  it("requires a valid positive room id", () => {
    for (const roomId of ["", "0", "-2", "abc", "1.5"]) {
      expect(validateBooking(values({ roomId }), NOW).roomId).toBeTruthy();
    }
  });

  it("rejects a start time in the past", () => {
    const errors = validateBooking(
      values({
        start: formatDateTimeInput(addMinutes(NOW, -30)),
        end: formatDateTimeInput(addMinutes(NOW, 30)),
      }),
      NOW,
    );

    expect(errors.start).toContain("past");
  });

  it("enforces an ordered duration between 15 minutes and four hours", () => {
    expect(validateBooking(values({ end: formatDateTimeInput(START) }), NOW).end).toContain(
      "after",
    );
    expect(
      validateBooking(values({ end: formatDateTimeInput(addMinutes(START, 14)) }), NOW).end,
    ).toContain("15 minutes");
    expect(
      validateBooking(values({ end: formatDateTimeInput(addMinutes(START, 15)) }), NOW).end,
    ).toBeUndefined();
    expect(
      validateBooking(values({ end: formatDateTimeInput(addMinutes(START, 240)) }), NOW).end,
    ).toBeUndefined();
    expect(
      validateBooking(values({ end: formatDateTimeInput(addMinutes(START, 241)) }), NOW).end,
    ).toContain("4 hours");
  });

  it("rejects empty or malformed datetime-local values", () => {
    const errors = validateBooking(values({ start: "", end: "not-a-date" }), NOW);

    expect(errors.start).toBeTruthy();
    expect(errors.end).toBeTruthy();
  });
});

describe("createInitialValues", () => {
  it("starts a draft on the selected local date with a one-hour window", () => {
    const draft = createInitialValues("2035-01-15", 2, NOW);

    expect(draft).toEqual({
      title: "",
      organiser: "",
      roomId: "2",
      start: "2035-01-15T09:00",
      end: "2035-01-15T10:00",
    });
    expect(localDateKey(new Date(draft.start))).toBe("2035-01-15");
  });

  it("leaves the room empty when no room is supplied", () => {
    expect(createInitialValues("2035-01-16", null, NOW).roomId).toBe("");
  });
});
