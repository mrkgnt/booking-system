import { z } from "zod";

export const bookingLookupQuerySchema = z.object({
  token: z.string().min(10),
  // Falls back to the tenant's business_profile.default_locale when
  // omitted — same fallback shape as createBookingSchema's `locale`.
  locale: z.enum(["lv", "ru", "en"]).optional(),
});
export type BookingLookupQuery = z.infer<typeof bookingLookupQuerySchema>;
