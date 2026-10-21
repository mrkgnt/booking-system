import { z } from "zod";

export const listBookingsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  staffId: z.string().uuid().optional(),
  status: z
    .enum(["pending_verification", "confirmed", "completed", "cancelled", "no_show"])
    .optional(),
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;

export const forceBookSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startsAt: z.string().datetime(),
  locale: z.enum(["lv", "ru", "en"]),
  description: z.string().max(2000).optional(),
  customer: z
    .object({
      name: z.string().min(1).max(200),
      email: z.string().email().optional(),
      phone: z.string().min(5).max(32).optional(),
    })
    .refine((p) => p.email || p.phone, { message: "email or phone is required" }),
});
export type ForceBookInput = z.infer<typeof forceBookSchema>;

export const bookingIdParamSchema = z.object({ id: z.string().uuid() });

export const staffRescheduleSchema = z.object({
  newStartsAt: z.string().datetime(),
});
export type StaffRescheduleInput = z.infer<typeof staffRescheduleSchema>;
