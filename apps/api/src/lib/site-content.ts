// Pure, DB-independent core of the Site Content CMS (ADR-0005). Kept
// separate from the admin-site-content.ts route so the actual business
// rules — which required fields are missing, and which fields belong to a
// locale's own content row vs. the Tenant's canonical (default-locale) row
// — are unit-testable without a live Supabase project.

export type SiteSectionField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "image";
  required: boolean;
  localized: boolean;
};

// Matches db/tenant-schema.sql's site_sections row shape (the columns this
// module actually reads — callers may pass the full row).
export type SiteSectionRow = {
  section_key: string;
  fields: SiteSectionField[];
};

// { [sectionKey]: { [fieldKey]: value } } — matches site_content.content.
export type SiteContentValue = Record<string, Record<string, unknown>>;

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

// Returns "sectionKey.fieldKey" for every field a site_sections schema
// marks required: true whose submitted value is missing or empty. A basic
// non-empty check, not a full dynamic validator (see issue #18's
// Implementation Decisions) — checks exactly what was submitted, since
// validation happens before any canonical/own-locale split.
export function findMissingRequiredFields(sections: SiteSectionRow[], content: SiteContentValue): string[] {
  const missing: string[] = [];
  for (const section of sections) {
    const sectionContent = content[section.section_key] ?? {};
    for (const field of section.fields) {
      if (!field.required) continue;
      if (isEmptyValue(sectionContent[field.key])) {
        missing.push(`${section.section_key}.${field.key}`);
      }
    }
  }
  return missing;
}

// Splits submitted content by each field's `localized` flag: a
// `localized: false` field's value is always written to (and read from)
// the Tenant's default_locale content row, regardless of which locale is
// currently being edited — never duplicated into every locale's row.
// Fields not present in `content` are simply omitted from both buckets.
export function splitContentByLocalization(
  sections: SiteSectionRow[],
  content: SiteContentValue,
): { ownLocale: SiteContentValue; canonical: SiteContentValue } {
  const ownLocale: SiteContentValue = {};
  const canonical: SiteContentValue = {};
  for (const section of sections) {
    const sectionContent = content[section.section_key];
    if (!sectionContent) continue;
    for (const field of section.fields) {
      if (!(field.key in sectionContent)) continue;
      const bucket = field.localized === false ? canonical : ownLocale;
      bucket[section.section_key] ??= {};
      bucket[section.section_key][field.key] = sectionContent[field.key];
    }
  }
  return { ownLocale, canonical };
}

// Merges a locale's own stored content over the canonical (default-locale)
// row's content, field by field, with ownLocale winning on a shared key.
// Used both to render a full read-side view (canonical fills in any
// localized:false field a non-default locale's row never stores) and to
// merge a partial write onto what's already stored in a row.
export function mergeLocalizedContent(canonical: SiteContentValue, ownLocale: SiteContentValue): SiteContentValue {
  const merged: SiteContentValue = {};
  const sectionKeys = new Set([...Object.keys(canonical), ...Object.keys(ownLocale)]);
  for (const key of sectionKeys) {
    merged[key] = { ...(canonical[key] ?? {}), ...(ownLocale[key] ?? {}) };
  }
  return merged;
}
