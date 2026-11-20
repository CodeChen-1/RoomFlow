import type { ReactNode } from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import type { Booking, Room } from "../api/types";
import {
  formatDateHeading,
  formatDateTime,
  formatDuration,
  formatTimeRange,
  localDateKey,
  minutesBetween,
} from "../lib/datetime";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { StatusBadge } from "./StatusBadge";

interface BookingDetailsProps {
  booking: Booking;
  room?: Room;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarDays;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
      </div>
    </div>
  );
}

export function BookingDetails({
  booking,
  room,
  onClose,
  onEdit,
  onCancel,
}: BookingDetailsProps) {
  const cancelled = booking.status === "cancelled";
  const duration = minutesBetween(booking.start_at, booking.end_at);

  return (
    <Modal title="Reservation details" subtitle={booking.title} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={booking.status} />
          <span className="chip">{formatDuration(duration)}</span>
        </div>

        {cancelled ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            This reservation is cancelled and no longer blocks the room.
          </div>
        ) : null}

        <dl className="divide-y divide-slate-100">
          <DetailRow icon={UserRound} label="Organiser">
            {booking.organiser}
          </DetailRow>
          <DetailRow icon={MapPin} label="Room">
            {room ? (
              <span>
                {room.name}
                <span className="mt-0.5 block text-xs text-slate-500">{room.location}</span>
              </span>
            ) : (
              `Room ${booking.room_id}`
            )}
          </DetailRow>
          {room ? (
            <DetailRow icon={Users} label="Capacity">
              {room.capacity} people
            </DetailRow>
          ) : null}
          <DetailRow icon={CalendarDays} label="Date">
            {formatDateHeading(localDateKey(new Date(booking.start_at)))}
          </DetailRow>
          <DetailRow icon={Clock3} label="Time">
            <span className="tabular-nums">
              {formatTimeRange(booking.start_at, booking.end_at)}
            </span>
          </DetailRow>
        </dl>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
          Created {formatDateTime(booking.created_at)}
          {booking.updated_at !== booking.created_at
            ? ` · Updated ${formatDateTime(booking.updated_at)}`
            : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!cancelled ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="secondary" onClick={onCancel}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Cancel reservation
              </Button>
              <Button onClick={onEdit}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit reservation
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
