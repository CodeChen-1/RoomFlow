import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Booking, Room } from "../api/types";
import { addMinutes, formatDateTimeInput } from "../lib/datetime";

const apiMocks = vi.hoisted(() => ({
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
}));

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    createBooking: apiMocks.createBooking,
    updateBooking: apiMocks.updateBooking,
  };
});

import { ApiError } from "../api/client";
import { BookingForm } from "./BookingForm";

const ROOM: Room = {
  id: 1,
  name: "Atlas Boardroom",
  capacity: 16,
  location: "Level 3",
  facilities: ["Display", "Whiteboard"],
  available: true,
};

function booking(start: Date, end: Date): Booking {
  return {
    id: 7,
    room_id: ROOM.id,
    title: "Product planning",
    organiser: "Alex Morgan",
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function renderForm(onSaved = vi.fn()) {
  const start = new Date(formatDateTimeInput(addMinutes(new Date(), 120)));
  const end = addMinutes(start, 60);
  render(
    <BookingForm
      mode="create"
      rooms={[ROOM]}
      initial={{ roomId: ROOM.id, start, end }}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );
  return { start, end, onSaved };
}

function fillValidFields() {
  fireEvent.change(screen.getByLabelText("Meeting title"), {
    target: { value: "Product planning" },
  });
  fireEvent.change(screen.getByLabelText("Organiser"), {
    target: { value: "Alex Morgan" },
  });
}

describe("BookingForm", () => {
  it("creates a reservation and reports the saved booking", async () => {
    apiMocks.createBooking.mockReset();
    const { start, end, onSaved } = renderForm();
    const saved = booking(start, end);
    apiMocks.createBooking.mockResolvedValue(saved);

    fillValidFields();
    fireEvent.click(screen.getByRole("button", { name: "Create reservation" }));

    await waitFor(() => expect(apiMocks.createBooking).toHaveBeenCalledTimes(1));
    expect(apiMocks.createBooking).toHaveBeenCalledWith({
      room_id: ROOM.id,
      title: "Product planning",
      organiser: "Alex Morgan",
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved, "create"));
  });

  it("shows validation errors without calling the API", () => {
    apiMocks.createBooking.mockReset();
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Create reservation" }));

    expect(screen.getByText("Enter a meeting title.")).toBeTruthy();
    expect(screen.getByText("Enter the organiser's name.")).toBeTruthy();
    expect(apiMocks.createBooking).not.toHaveBeenCalled();
  });

  it("surfaces a server conflict in the form", async () => {
    apiMocks.createBooking.mockReset();
    renderForm();
    apiMocks.createBooking.mockRejectedValue(
      new ApiError(
        409,
        "booking_conflict",
        "This room is already booked during that time. Choose another room or time.",
      ),
    );

    fillValidFields();
    fireEvent.click(screen.getByRole("button", { name: "Create reservation" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("already booked");
  });
});
