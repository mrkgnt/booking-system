import { getSiteSupabaseClient } from "./supabase.js";

// Shape of a site_sections.fields array entry (db/tenant-schema.sql,
// ADR-0005). Kept as a local type rather than importing apps/api's generated
// Database type — apps/site stays self-contained like apps/widget already
// is ("no shared packages", ADR-0004), and these two tables aren't in the
// generated types yet anyway (schema-only ticket #28 didn't touch apps/api).
export type SiteSectionField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "image";
  required: boolean;
  localized: boolean;
};

export type SiteContentBundle = {
  // section_key -> that section's field definitions.
  sections: Record<string, SiteSectionField[]>;
  // section_key -> { field_key: value }, already resolved for one locale
  // (see getSiteContent's merge rule for localized:false fields below).
  content: Record<string, Record<string, string>>;
};

// A repeatable list field (value_props' checklist, the gallery's image list)
// is stored as one textarea value, one item per line — no dedicated field
// `type` for "list" (issue #18's decision). Parsing happens here, where the
// value is consumed, not in the schema.
export function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Exact (section, field) lookup — used where the field key is known ahead of
// time (e.g. quick_contact's whatsapp_url/telegram_url, per issue #25).
// Always returns "" rather than undefined/null for a missing/blank field, so
// callers can treat "blank" and "never saved" identically (both hide the
// row, never render a broken/empty link).
export function getFieldValueByKey(bundle: SiteContentBundle, sectionKey: string, fieldKey: string): string {
  return bundle.content[sectionKey]?.[fieldKey]?.trim() ?? "";
}

// Lookup by the field's declared `type` rather than an assumed key name —
// used for sections with exactly one field whose literal key isn't fixed by
// this ticket's spec (value_props' checklist textarea). This is the
// schema-driven read ADR-0005 is actually for: as long as the site_sections
// row declares a field of the right type, this resolves correctly regardless
// of what key a sibling ticket's seed happened to name it.
export function getFirstFieldValueByType(
  bundle: SiteContentBundle,
  sectionKey: string,
  type: SiteSectionField["type"],
): string {
  const field = (bundle.sections[sectionKey] ?? []).find((f) => f.type === type);
  if (!field) return "";
  return getFieldValueByKey(bundle, sectionKey, field.key);
}

// Fetches a page's full site_sections schema + site_content values and
// resolves them to one locale. A `localized: false` field (e.g.
// quick_contact's URLs) is saved once under one canonical locale row, not
// duplicated into every locale (ADR-0005) — so every locale's row is merged
// first (making a non-localized field visible no matter which locale row it
// was actually saved under), then the exact-locale row is layered on top
// (so a `localized: true` field still resolves to the right-locale value,
// not whatever happened to merge in from another locale).
// Never throws — a down/misconfigured Supabase project (including a missing
// SUPABASE_URL/SUPABASE_SECRET_KEY env var, which getSiteSupabaseClient
// throws for) degrades a page's optional sections to "render nothing"
// rather than crashing the whole SSR render, matching apps/widget's
// fetchTenantInfo precedent — console.error still logs clearly server-side
// either way, so a real misconfiguration is loud in the logs, just not
// fatal to the page.
export async function getSiteContent(pageSlug: string, locale: string): Promise<SiteContentBundle> {
  const empty: SiteContentBundle = { sections: {}, content: {} };
  try {
    const supabase = getSiteSupabaseClient();
    const [{ data: sectionRows, error: sectionsError }, { data: contentRows, error: contentError }] =
      await Promise.all([
        supabase
          .from("site_sections")
          .select("section_key, fields")
          .eq("page_slug", pageSlug)
          .order("display_order", { ascending: true }),
        supabase.from("site_content").select("locale, content").eq("page_slug", pageSlug),
      ]);

    if (sectionsError) console.error(`[site] site_sections read failed for page "${pageSlug}":`, sectionsError);
    if (contentError) console.error(`[site] site_content read failed for page "${pageSlug}":`, contentError);

    const sections: Record<string, SiteSectionField[]> = {};
    for (const row of sectionRows ?? []) {
      sections[row.section_key as string] = (row.fields as SiteSectionField[] | null) ?? [];
    }

    const content: Record<string, Record<string, string>> = {};
    const mergeRow = (row: { content: unknown } | undefined) => {
      const rowContent = (row?.content as Record<string, Record<string, string>> | null) ?? {};
      for (const [sectionKey, fields] of Object.entries(rowContent)) {
        content[sectionKey] = { ...content[sectionKey], ...fields };
      }
    };
    for (const row of contentRows ?? []) mergeRow(row);
    mergeRow((contentRows ?? []).find((row) => row.locale === locale));

    return { sections, content };
  } catch (err) {
    console.error(`[site] getSiteContent errored for page "${pageSlug}":`, err);
    return empty;
  }
}

// business_profile has no `anon` grant (unlike the catalog tables) — see
// supabase.ts's note on why this app reads it with the secret key. Never
// throws (see getSiteContent's note above) — a missing address just hides
// the "find us" band (FindUs.astro) instead of crashing the page.
export async function getBusinessAddress(): Promise<string | null> {
  try {
    const supabase = getSiteSupabaseClient();
    const { data, error } = await supabase.from("business_profile").select("address").single();
    if (error) {
      console.error("[site] business_profile.address read failed:", error);
      return null;
    }
    return (data?.address as string | null) ?? null;
  } catch (err) {
    console.error("[site] getBusinessAddress errored:", err);
    return null;
  }
}
