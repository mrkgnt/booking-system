import { z } from "zod";

export const siteSectionsQuerySchema = z.object({
  page: z.string().min(1),
});
export type SiteSectionsQuery = z.infer<typeof siteSectionsQuerySchema>;
