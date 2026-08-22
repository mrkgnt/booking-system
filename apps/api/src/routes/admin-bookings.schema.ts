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
