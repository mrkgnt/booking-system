import type { TypedSupabaseClient } from "./supabase.js";
import { hasBufferConflict } from "./availability.js";

export async function hasExistingConflict(
  supabase: TypedSupabaseClient,
  staffId: string,
  startsAt: Date,
  endsAt: Date,
  service: { buffer_minutes_before: number; buffer_minutes_after: number },
  excludeBookingId?: string,
): Promise<boolean> {
  const bufferMs = 24 * 60 * 60_000; // widen the query window by a day either side to safely catch buffer-adjacent bookings
  let query = supabase
    .from("bookings")
    .select("starts_at, ends_at, services:service_id(buffer_minutes_before, buffer_minutes_after)")
    .eq("staff_id", staffId)
    .not("status", "in", "(cancelled,no_show)")
    .gte("starts_at", new Date(startsAt.getTime() - bufferMs).toISOString())
    .lte("starts_at", new Date(endsAt.getTime() + bufferMs).toISOString());
  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }
  const { data: nearby } = await query;

  return hasBufferConflict(
    {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      bufferBeforeMinutes: service.buffer_minutes_before,
      bufferAfterMinutes: service.buffer_minutes_after,
    },
    (nearby ?? []).map((b) => {
      const svc = b.services as { buffer_minutes_before: number; buffer_minutes_after: number } | null;
      return {
        staffId,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        bufferBeforeMinutes: svc?.buffer_minutes_before ?? 0,
        bufferAfterMinutes: svc?.buffer_minutes_after ?? 0,
      };
    }),
  );
}
