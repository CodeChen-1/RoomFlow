import { describe, expect, it } from "vitest";

import { pageLabel, parseRoute } from "./router";

describe("parseRoute", () => {
  it("defaults to the dashboard", () => {
    expect(parseRoute("")).toEqual({ page: "dashboard", date: undefined });
    expect(parseRoute("#/")).toEqual({ page: "dashboard", date: undefined });
    expect(parseRoute("#/unknown")).toEqual({ page: "dashboard", date: undefined });
  });

  it("parses page routes and valid dates", () => {
    expect(parseRoute("#/rooms")).toEqual({ page: "rooms", date: undefined });
    expect(parseRoute("#/reservations?date=2026-11-19")).toEqual({
      page: "reservations",
      date: "2026-11-19",
    });
  });

  it("ignores malformed date values", () => {
    expect(parseRoute("#/reservations?date=19-11-2026").date).toBeUndefined();
    expect(parseRoute("#/reservations?date=2026-13-40").date).toBeUndefined();
  });

  it("labels each page", () => {
    expect(pageLabel("dashboard")).toBe("Dashboard");
    expect(pageLabel("rooms")).toBe("Rooms");
    expect(pageLabel("reservations")).toBe("Reservations");
  });
});
