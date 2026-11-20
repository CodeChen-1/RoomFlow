export type BookingStatus = "active" | "cancelled";

export interface Room {
  id: number;
  name: string;
  capacity: number;
  location: string;
  facilities: string[];
  available: boolean | null;
}

export interface Booking {
  id: number;
  room_id: number;
  title: string;
  organiser: string;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export interface BookingInput {
  room_id: number;
  title: string;
  organiser: string;
  start_at: string;
  end_at: string;
}

export type BookingPatch = Partial<BookingInput>;

export interface RoomQuery {
  start_at?: string;
  end_at?: string;
  min_capacity?: number;
  facility?: string[];
}

export interface BookingQuery {
  start_at?: string;
  end_at?: string;
  room_id?: number;
  status?: BookingStatus;
  upcoming?: boolean;
}
