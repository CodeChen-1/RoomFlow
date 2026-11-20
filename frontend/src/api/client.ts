import type {
  Booking,
  BookingInput,
  BookingPatch,
  BookingQuery,
  Room,
  RoomQuery,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function withQuery(path: string, params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Cannot reach the RoomFlow API. Make sure the backend is running.",
    );
  }

  if (!response.ok) {
    let message =
      response.status >= 500
        ? "The RoomFlow API is unavailable. Make sure the backend is running on port 8000."
        : `The request failed (${response.status}).`;
    let code = "request_failed";
    try {
      const payload = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      if (payload.error?.message) message = payload.error.message;
      if (payload.error?.code) code = payload.error.code;
    } catch {
      code = "request_failed";
      message = `The request failed (${response.status}).`;
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export function listRooms(params: RoomQuery = {}): Promise<Room[]> {
  const path = withQuery("/rooms", {
    start_at: params.start_at,
    end_at: params.end_at,
    min_capacity: params.min_capacity,
  });
  if (!params.facility?.length) return request<Room[]>(path);

  const search = new URLSearchParams(path.split("?")[1] ?? "");
  params.facility.forEach((facility) => search.append("facility", facility));
  return request<Room[]>(`/rooms?${search.toString()}`);
}

export function listBookings(params: BookingQuery = {}): Promise<Booking[]> {
  return request<Booking[]>(
    withQuery("/bookings", {
      start_at: params.start_at,
      end_at: params.end_at,
      room_id: params.room_id,
      status: params.status,
      upcoming: params.upcoming || undefined,
    }),
  );
}

export function createBooking(input: BookingInput): Promise<Booking> {
  return request<Booking>("/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBooking(id: number, patch: BookingPatch): Promise<Booking> {
  return request<Booking>(`/bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function cancelBooking(id: number): Promise<Booking> {
  return request<Booking>(`/bookings/${id}/cancel`, { method: "POST" });
}
