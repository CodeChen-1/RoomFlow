import { addMinutes, defaultStartForDate, formatDateTimeInput } from "./datetime";

export interface BookingFormValues {
  title: string;
  organiser: string;
  roomId: string;
  start: string;
  end: string;
}

export type BookingField = keyof BookingFormValues;
export type BookingErrors = Partial<Record<BookingField, string>>;

const MIN_DURATION_MS = 15 * 60_000;
const MAX_DURATION_MS = 4 * 60 * 60_000;

export function validateBooking(
  values: BookingFormValues,
  now: Date = new Date(),
): BookingErrors {
  const errors: BookingErrors = {};
  const title = values.title.trim();
  const organiser = values.organiser.trim();

  if (!title) errors.title = "Enter a meeting title.";
  else if (title.length > 160) errors.title = "Keep the meeting title under 160 characters.";

  if (!organiser) errors.organiser = "Enter the organiser's name.";
  else if (organiser.length > 100) errors.organiser = "Keep the organiser's name under 100 characters.";

  const roomId = Number(values.roomId);
  if (!values.roomId || !Number.isInteger(roomId) || roomId <= 0) {
    errors.roomId = "Choose a room.";
  }

  const start = values.start ? new Date(values.start) : null;
  const end = values.end ? new Date(values.end) : null;

  if (!start || Number.isNaN(start.getTime())) {
    errors.start = "Choose a start date and time.";
  } else if (start.getTime() < now.getTime()) {
    errors.start = "The start time cannot be in the past.";
  }

  if (!end || Number.isNaN(end.getTime())) {
    errors.end = "Choose an end date and time.";
  }

  if (start && end && !errors.start && !errors.end) {
    const duration = end.getTime() - start.getTime();
    if (duration <= 0) errors.end = "The end time must be after the start time.";
    else if (duration < MIN_DURATION_MS) errors.end = "Meetings must last at least 15 minutes.";
    else if (duration > MAX_DURATION_MS) errors.end = "Meetings cannot last longer than 4 hours.";
  }

  return errors;
}

export function hasErrors(errors: BookingErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function createInitialValues(
  dateKey: string,
  roomId?: number | null,
  now: Date = new Date(),
): BookingFormValues {
  const start = defaultStartForDate(dateKey, now);
  const end = addMinutes(start, 60);
  return {
    title: "",
    organiser: "",
    roomId: roomId ? String(roomId) : "",
    start: formatDateTimeInput(start),
    end: formatDateTimeInput(end),
  };
}
