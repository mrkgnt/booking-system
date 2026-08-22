import { z } from "zod";

const localizedTextSchema = z.record(z.string(), z.string().min(1));

export const categoryIdParamSchema = z.object({ id: z.string().uuid() });

export const createServiceCategorySchema = z.object({
  icon: z.string().max(100).optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  name: localizedTextSchema,
});
export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;

export const updateServiceCategorySchema = z.object({
  icon: z.string().max(100).optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  name: localizedTextSchema.optional(),
});
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>;
