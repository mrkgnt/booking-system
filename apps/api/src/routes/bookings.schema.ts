import { z } from "zod";

export const availabilityQuerySchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const createBookingSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().optional(), // omitted = "any eligible staff"
  // startsAt is the exact slot returned by GET /availability. endsAt is
  // deliberately not accepted from the client — the server derives it from
  // the service's duration, never trusting a client-submitted end time.
  startsAt: z.string().datetime(),
  locale: z.enum(["lv", "ru", "en"]),
  description: z.string().max(2000).optional(),
  patient: z
    .object({
      name: z.string().min(1).max(200),
      email: z.string().email().optional(),
      phone: z.string().min(5).max(32).optional(),
    })
    .refine((p) => p.email || p.phone, { message: "email or phone is required" }),
  consentGiven: z.literal(true),
  idempotencyKey: z.string().min(10).max(200),
  turnstileToken: z.string().optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const confirmBookingSchema = z.object({
  token: z.string().min(10),
});
export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;
