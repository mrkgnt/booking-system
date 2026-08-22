import { z } from "zod";

export const businessHoursQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
});
export type BusinessHoursQuery = z.infer<typeof businessHoursQuerySchema>;

const hourEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable(),
  closesAt: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable(),
  isClosed: z.boolean().default(false),
});

export const replaceBusinessHoursSchema = z.object({
  staffId: z.string().uuid().nullable(),
  hours: z.array(hourEntrySchema).min(1).max(7),
});
export type ReplaceBusinessHoursInput = z.infer<typeof replaceBusinessHoursSchema>;
