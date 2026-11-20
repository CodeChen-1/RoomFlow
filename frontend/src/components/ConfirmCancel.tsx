import { useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

import { cancelBooking, getErrorMessage } from "../api/client";
import type { Booking } from "../api/types";
import { formatDateHeading, formatTimeRange, localDateKey } from "../lib/datetime";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmCancelProps {
  booking: Booking;
  roomName: string;
  onClose: () => void;
  onCancelled: (booking: Booking) => void;
}

export function ConfirmCancel({
  booking,
  roomName,
  onClose,
  onCancelled,
}: ConfirmCancelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const cancelled = await cancelBooking(booking.id);
      onCancelled(cancelled);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Cancel this reservation?"
      subtitle={booking.title}
      size="sm"
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="text-sm leading-6 text-amber-950">
            <p className="font-semibold">The time slot will be released.</p>
            <p className="mt-1 text-amber-900">
              {roomName} · {formatDateHeading(localDateKey(new Date(booking.start_at)))} ·{" "}
              <span className="tabular-nums">
                {formatTimeRange(booking.start_at, booking.end_at)}
              </span>
            </p>
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </p>
        ) : null}

        <p className="text-sm leading-6 text-slate-600">
          The reservation stays in your history with a cancelled status.
        </p>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting} data-autofocus>
            Keep reservation
          </Button>
          <Button variant="danger" onClick={handleCancel} disabled={submitting}>
            {submitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Cancelling…
              </>
            ) : (
              "Cancel reservation"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
