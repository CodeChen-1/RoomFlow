import { useState, type FormEvent } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

import { ApiError, createBooking, getErrorMessage, updateBooking } from "../api/client";
import type { Booking, BookingInput, Room } from "../api/types";
import {
  formatDateTimeInput,
  parseDateTimeInput,
  timezoneLabel,
  todayKey,
} from "../lib/datetime";
import {
  createInitialValues,
  hasErrors,
  validateBooking,
  type BookingErrors,
  type BookingFormValues,
} from "../lib/validation";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface InitialValues {
  title?: string;
  organiser?: string;
  roomId?: number | null;
  start?: Date;
  end?: Date;
}

interface BookingFormProps {
  mode: "create" | "edit";
  rooms: Room[];
  bookingId?: number;
  initial?: InitialValues;
  onClose: () => void;
  onSaved: (booking: Booking, mode: "create" | "edit") => void;
}

const FIELD_IDS: Record<keyof BookingFormValues, string> = {
  title: "booking-title",
  organiser: "booking-organiser",
  roomId: "booking-room",
  start: "booking-start",
  end: "booking-end",
};

export function BookingForm({
  mode,
  rooms,
  bookingId,
  initial,
  onClose,
  onSaved,
}: BookingFormProps) {
  const [values, setValues] = useState<BookingFormValues>(() => {
    if (!initial) return createInitialValues(todayKey());
    return {
      title: initial.title ?? "",
      organiser: initial.organiser ?? "",
      roomId: initial.roomId ? String(initial.roomId) : "",
      start: initial.start ? formatDateTimeInput(initial.start) : "",
      end: initial.end ? formatDateTimeInput(initial.end) : "",
    };
  });
  const [errors, setErrors] = useState<BookingErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof BookingFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateBooking(values);
    setErrors(nextErrors);
    setServerError(null);

    if (hasErrors(nextErrors)) {
      const firstField = (Object.keys(nextErrors) as (keyof BookingFormValues)[])[0];
      document.getElementById(FIELD_IDS[firstField])?.focus();
      return;
    }

    const start = parseDateTimeInput(values.start);
    const end = parseDateTimeInput(values.end);
    if (!start || !end) return;

    const input: BookingInput = {
      room_id: Number(values.roomId),
      title: values.title.trim(),
      organiser: values.organiser.trim(),
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    };

    setSubmitting(true);
    try {
      const saved =
        mode === "edit" && bookingId
          ? await updateBooking(bookingId, input)
          : await createBooking(input);
      onSaved(saved, mode);
    } catch (error) {
      if (error instanceof ApiError) setServerError(error.message);
      else setServerError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const errorFor = (field: keyof BookingFormValues, id: string) => {
    if (!errors[field]) return null;
    return (
      <p id={id} className="field-error">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {errors[field]}
      </p>
    );
  };

  const describedBy = (field: keyof BookingFormValues) =>
    errors[field] ? `${FIELD_IDS[field]}-error` : undefined;

  return (
    <Modal
      title={mode === "create" ? "New reservation" : "Edit reservation"}
      subtitle={
        mode === "create"
          ? "Reserve a room for a focused block of time."
          : "Update the meeting details or move the booking."
      }
      onClose={onClose}
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {serverError ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <p className="font-medium leading-5">{serverError}</p>
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="booking-title">
            Meeting title
          </label>
          <input
            id="booking-title"
            className="input"
            value={values.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="e.g. Product planning"
            maxLength={160}
            aria-required="true"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={describedBy("title")}
            data-autofocus
          />
          {errorFor("title", "booking-title-error")}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="booking-organiser">
              Organiser
            </label>
            <input
              id="booking-organiser"
              className="input"
              value={values.organiser}
              onChange={(event) => updateField("organiser", event.target.value)}
              placeholder="Your name"
              maxLength={100}
              aria-required="true"
              aria-invalid={Boolean(errors.organiser)}
              aria-describedby={describedBy("organiser")}
            />
            {errorFor("organiser", "booking-organiser-error")}
          </div>

          <div>
            <label className="label" htmlFor="booking-room">
              Room
            </label>
            <select
              id="booking-room"
              className="input"
              value={values.roomId}
              onChange={(event) => updateField("roomId", event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.roomId)}
              aria-describedby={describedBy("roomId")}
            >
              <option value="">Select a room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} · {room.capacity} people
                </option>
              ))}
            </select>
            {errorFor("roomId", "booking-room-error")}
            {rooms.length === 0 ? (
              <p className="mt-1.5 text-xs font-medium text-amber-700">
                No rooms are available to book right now.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="booking-start">
              Start
            </label>
            <input
              id="booking-start"
              type="datetime-local"
              className="input"
              value={values.start}
              onChange={(event) => updateField("start", event.target.value)}
              step={300}
              aria-required="true"
              aria-invalid={Boolean(errors.start)}
              aria-describedby={describedBy("start")}
            />
            {errorFor("start", "booking-start-error")}
          </div>

          <div>
            <label className="label" htmlFor="booking-end">
              End
            </label>
            <input
              id="booking-end"
              type="datetime-local"
              className="input"
              value={values.end}
              onChange={(event) => updateField("end", event.target.value)}
              step={300}
              aria-required="true"
              aria-invalid={Boolean(errors.end)}
              aria-describedby={describedBy("end")}
            />
            {errorFor("end", "booking-end-error")}
          </div>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          Between 15 minutes and 4 hours. {timezoneLabel()}.
        </p>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || rooms.length === 0}>
            {submitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : mode === "create" ? (
              "Create reservation"
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
