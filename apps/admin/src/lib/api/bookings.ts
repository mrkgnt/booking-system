import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";

export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type BookingStatus = "pending_verification" | "confirmed" | "completed" | "cancelled" | "no_show";

export type ListBookingsFilters = { from?: string; to?: string; staffId?: string; status?: BookingStatus };

export function buildBookingsQuery(filters: ListBookingsFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.staffId) params.set("staffId", filters.staffId);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function listBookings(config: ApiClientConfig, filters: ListBookingsFilters = {}): Promise<Booking[]> {
  const { bookings } = await apiFetch<{ bookings: Booking[] }>(config, `/admin/bookings${buildBookingsQuery(filters)}`);
  return bookings;
}

export type ForceBookInput = {
  serviceId: string; staffId: string; startsAt: string; locale: "lv" | "ru" | "en";
  description?: string; patient: { name: string; email?: string; phone?: string };
};

export async function forceBookBooking(config: ApiClientConfig, input: ForceBookInput): Promise<Booking> {
  const { booking } = await apiFetch<{ booking: Booking }>(config, "/admin/bookings", { method: "POST", body: JSON.stringify(input) });
  return booking;
}

export async function cancelBooking(config: ApiClientConfig, bookingId: string): Promise<Booking> {
  const { booking } = await apiFetch<{ booking: Booking }>(config, `/admin/bookings/${bookingId}/cancel`, { method: "POST" });
  return booking;
}

export async function rescheduleBooking(config: ApiClientConfig, bookingId: string, newStartsAt: string): Promise<Booking> {
  const { booking } = await apiFetch<{ booking: Booking }>(config, `/admin/bookings/${bookingId}/reschedule`, {
    method: "POST", body: JSON.stringify({ newStartsAt }),
  });
  return booking;
}
