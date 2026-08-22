import { z } from "zod";

const localizedTextSchema = z.record(z.string(), z.string().min(1));

export const serviceIdParamSchema = z.object({ id: z.string().uuid() });

export const createServiceSchema = z.object({
  categoryId: z.string().uuid().optional(),
  durationMinutes: z.number().int().positive(),
  bufferMinutesBefore: z.number().int().nonnegative().default(0),
  bufferMinutesAfter: z.number().int().nonnegative().default(0),
  priceAmount: z.number().nonnegative().optional(),
  priceCurrency: z.string().length(3).default("EUR"),
  pricePrefix: z.enum(["exact", "from", "up_to"]).default("exact"),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  name: localizedTextSchema,
  description: localizedTextSchema.optional(),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  durationMinutes: z.number().int().positive().optional(),
  bufferMinutesBefore: z.number().int().nonnegative().optional(),
  bufferMinutesAfter: z.number().int().nonnegative().optional(),
  priceAmount: z.number().nonnegative().nullable().optional(),
  priceCurrency: z.string().length(3).optional(),
  pricePrefix: z.enum(["exact", "from", "up_to"]).optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  name: localizedTextSchema.optional(),
  description: localizedTextSchema.optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
