import { z } from "zod";

export const listClosuresQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
});
export type ListClosuresQuery = z.infer<typeof listClosuresQuerySchema>;

export const createClosureSchema = z.object({
  staffId: z.string().uuid().nullable(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).optional(),
  isRecurringYearly: z.boolean().default(false),
});
export type CreateClosureInput = z.infer<typeof createClosureSchema>;

export const closureIdParamSchema = z.object({ id: z.string().uuid() });
