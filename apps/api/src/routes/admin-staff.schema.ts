import { z } from "zod";

const localizedTextSchema = z.record(z.string(), z.string().min(1));

export const staffIdParamSchema = z.object({ id: z.string().uuid() });

export const createStaffSchema = z.object({
  name: z.string().min(1).max(200),
  photoUrl: z.string().url().optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isBookable: z.boolean().default(true),
  bio: localizedTextSchema.optional(),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  photoUrl: z.string().url().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isBookable: z.boolean().optional(),
  bio: localizedTextSchema.optional(),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const replaceStaffServicesSchema = z.object({
  serviceIds: z.array(z.string().uuid()),
});
export type ReplaceStaffServicesInput = z.infer<typeof replaceStaffServicesSchema>;
