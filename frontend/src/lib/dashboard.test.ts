import { describe, expect, it } from "vitest";

import type { Booking } from "../api/types";
import {
  activeBookingsOnDay,
  clippedInterval,
  computeDayStats,
} from "./dashboard";

const DAY_START = new Date(2035, 0, 15, 0, 0, 0, 0);
const DAY_END = new Date(2035, 0, 16, 0, 0, 0, 0);

function at(day: number, hour: number, minute = 0): string {
  return new Date(2035, 0, day, hour, minute, 0, 0).toISOString();
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 1,
    room_id: 1,
    title: "Planning session",
    organiser: "Alex Morgan",
    start_at: at(15, 9),
    end_at: at(15, 10),
    status: "active",
    created_at: at(14, 9),
    updated_at: at(14, 9),
    ...overrides,
  };
}

describe("clippedInterval", () => {
  it("clips a booking to the selected day", () => {
    const interval = clippedInterval(
      booking({ start_at: at(14, 23), end_at: at(15, 1) }),
      DAY_START,
      DAY_END,
    );

    expect(interval).toEqual({
      start: DAY_START.getTime(),
      end: new Date(2035, 0, 15, 1).getTime(),
    });
  });

  it("returns null for a booking outside the day", () => {
    expect(
      clippedInterval(
        booking({ start_at: at(14, 8), end_at: at(14, 9) }),
        DAY_START,
        DAY_END,
      ),
    ).toBeNull();
  });

  it("returns null for a zero-length clipped interval", () => {
    expect(
      clippedInterval(
        booking({ start_at: at(14, 20), end_at: at(15, 0) }),
        DAY_START,
        DAY_END,
      ),
    ).toBeNull();
  });
});

describe("activeBookingsOnDay", () => {
  it("keeps only active overlapping bookings in start order", () => {
    const late = booking({ id: 2, start_at: at(15, 14), end_at: at(15, 15) });
    const early = booking({ id: 3, start_at: at(15, 8), end_at: at(15, 9) });
    const cancelled = booking({
      id: 4,
      start_at: at(15, 10),
      end_at: at(15, 11),
      status: "cancelled",
    });

    expect(
      activeBookingsOnDay([late, cancelled, early], DAY_START, DAY_END).map(
        (item) => item.id,
      ),
    ).toEqual([3, 2]);
  });
});

describe("computeDayStats", () => {
  it("counts rooms and clips room-hours to the local day", () => {
    const stats = computeDayStats(
      [
        booking({ id: 1, room_id: 1, start_at: at(15, 9), end_at: at(15, 10) }),
        booking({ id: 2, room_id: 2, start_at: at(15, 23), end_at: at(16, 1) }),
        booking({ id: 3, room_id: 1, start_at: at(14, 23), end_at: at(15, 0, 30) }),
        booking({
          id: 4,
          room_id: 3,
          start_at: at(15, 11),
          end_at: at(15, 12),
          status: "cancelled",
        }),
      ],
      DAY_START,
      DAY_END,
      3,
    );

    expect(stats.count).toBe(3);
    expect(stats.roomsUsed).toBe(2);
    expect(stats.freeRooms).toBe(1);
    expect(stats.roomHours).toBe(2.5);
    expect(stats.byRoom.get(1)).toHaveLength(2);
    expect(stats.byRoom.get(2)?.[0].start).toBe(new Date(2035, 0, 15, 23).getTime());
  });

  it("handles a day with no matching bookings", () => {
    const stats = computeDayStats([], DAY_START, DAY_END, 6);

    expect(stats.count).toBe(0);
    expect(stats.roomsUsed).toBe(0);
    expect(stats.freeRooms).toBe(6);
    expect(stats.roomHours).toBe(0);
    expect(stats.byRoom.size).toBe(0);
  });
});
