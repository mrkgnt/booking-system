import { z } from "zod";

export const siteContentQuerySchema = z.object({
  page: z.string().min(1),
  locale: z.string().min(1),
});
export type SiteContentQuery = z.infer<typeof siteContentQuerySchema>;

// A section's field values — key => value. Field values are plain strings
// for every existing field type (text/textarea/image are all URL/plain-text
// inputs per issue #18's Out of Scope), but kept as z.unknown() here since
// the required-ness/emptiness check is schema-driven (findMissingRequiredFields),
// not this zod layer's job.
const sectionContentSchema = z.record(z.string(), z.unknown());

export const siteContentBodySchema = z.object({
  page: z.string().min(1),
  locale: z.string().min(1),
  content: z.record(z.string(), sectionContentSchema),
});
export type SiteContentInput = z.infer<typeof siteContentBodySchema>;
