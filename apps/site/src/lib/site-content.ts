import type { SupabaseClient } from "@supabase/supabase-js";

// Public read side of the Site Content CMS (ADR-0005, issue #22). Direct
// Supabase REST with the anon key — no apps/api round trip, matching the
// existing "Public catalog reads" pattern apps/widget's tenant-info and
// apps/admin already use. apps/site is a per-Tenant deployment with its
// own project credentials (unlike the shared, credential-less apps/widget),
// so this goes straight to PostgREST rather than through a shared proxy.
//
// Shape of the two tables this reads (db/tenant-schema.sql, section 9):
//   site_sections(page_slug, section_key, display_order, fields jsonb)
//   site_content(page_slug, locale, content jsonb)
// `fields` is `[{ key, label, type, required, localized }]` — the
// Section's developer-owned schema. `content` is
// `{ [section_key]: { [field_key]: value } }` — the Tenant-editable values.
//
// NOTE (merge of #22 + #23, 2026-10-22): the functions below this point
// (`parseImageUrls`, `fetchGalleryImageUrls`) are ticket #23's Gallery-only
// Site Content read, written independently before this file's fuller #22
// implementation had landed on `site-cms-integration`. They use the
// `@supabase/supabase-js` client (via `apps/site/src/lib/supabase.ts`'s
// `getSupabaseAnonClient()`) rather than this file's raw-`fetch`
// `SupabaseRestConfig` style above — two different Supabase-access
// patterns now coexist in one module. Left as-is at merge time (both work
// correctly; `Gallery.astro` already depends on the supabase-js signature)
// rather than risking a mid-merge rewrite of already-tested code; flagged
// here for a future consolidation pass.

export type FieldType = "text" | "textarea" | "image";

export interface SiteSectionField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  localized: boolean;
}

export interface SiteSectionSchema {
  pageSlug: string;
  sectionKey: string;
  displayOrder: number;
  fields: SiteSectionField[];
}

// content[locale][sectionKey][fieldKey] = value. Keyed by locale rather
// than a flat list since the resolution rule below needs to look up both
// the requested locale's row and the canonical locale's row by key.
export type ContentByLocale = Partial<Record<string, Record<string, Record<string, string>>>>;

export type SectionValues = Record<string, string>;

// ---------------------------------------------------------------------------
// Pure resolution logic — no network, the actual vitest seam for this
// module. The resolution rule (ADR-0005): a `localized: false` field
// (images, contact links) is entered once under the Tenant's canonical/
// default locale and always read from there, regardless of which locale
// the page is currently rendering. A `localized: true` field prefers the
// requested locale's own value, falling back to the canonical locale's
// value when the requested locale has no content row yet (a page not yet
// translated) or the field itself is blank there (a partial translation).
// ---------------------------------------------------------------------------

export function resolveSectionValues(
  schema: SiteSectionSchema,
  contentByLocale: ContentByLocale,
  locale: string,
  canonicalLocale: string,
): SectionValues {
  const requested = contentByLocale[locale]?.[schema.sectionKey];
  const canonical = contentByLocale[canonicalLocale]?.[schema.sectionKey];

  const resolved: SectionValues = {};
  for (const field of schema.fields) {
    if (field.localized) {
      const requestedValue = requested?.[field.key];
      resolved[field.key] = requestedValue && requestedValue.length > 0 ? requestedValue : canonical?.[field.key] ?? "";
    } else {
      resolved[field.key] = canonical?.[field.key] ?? "";
    }
  }
  return resolved;
}

// Splits a `textarea` field's raw value into paragraphs for the About
// section (issue #22). Rule: prefer blank-line-delimited paragraphs (the
// natural way to type multiple paragraphs into a plain textarea); only
// fall back to splitting on every single newline when the author didn't
// blank-line-separate at all (e.g. one paragraph per line, no blank rows)
// — otherwise a blank-line-separated block would also get needlessly
// split on sentence-wrapping newlines within a single paragraph. Each
// resulting block is trimmed and empty blocks are dropped.
export function splitIntoParagraphs(text: string | undefined | null): string[] {
  if (!text) return [];
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const blocks = normalized.includes("\n\n") ? normalized.split(/\n\s*\n+/) : normalized.split(/\n+/);
  return blocks.map((b) => b.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Supabase REST fetch wrappers. Never throw — a failed/non-2xx fetch
// (missing table, network blip) is logged via console.error and surfaced
// as an empty/null result, so a section component can render nothing for
// itself rather than crashing the page's SSR render. Mirrors
// apps/widget/src/lib/api/tenant-info.ts's shape.
// ---------------------------------------------------------------------------

export interface SupabaseRestConfig {
  supabaseUrl: string;
  anonKey: string;
}

function restHeaders(anonKey: string): HeadersInit {
  return { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
}

export function buildSiteSectionsUrl(supabaseUrl: string, pageSlug: string, sectionKey: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    page_slug: `eq.${pageSlug}`,
    section_key: `eq.${sectionKey}`,
    select: "page_slug,section_key,display_order,fields",
  });
  return `${base}/rest/v1/site_sections?${params.toString()}`;
}

export function buildSiteContentUrl(supabaseUrl: string, pageSlug: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({ page_slug: `eq.${pageSlug}`, select: "locale,content" });
  return `${base}/rest/v1/site_content?${params.toString()}`;
}

type SiteSectionRow = {
  page_slug: string;
  section_key: string;
  display_order: number;
  fields: SiteSectionField[];
};

type SiteContentRow = {
  locale: string;
  content: Record<string, Record<string, string>>;
};

// Fetches one Section's schema row. Filtered server-side by section_key so
// each self-contained section component (Hero.astro, About.astro, ...)
// only ever pulls its own definition, not the whole page's.
export async function fetchSectionSchema(
  config: SupabaseRestConfig,
  pageSlug: string,
  sectionKey: string,
): Promise<SiteSectionSchema | null> {
  try {
    const res = await fetch(buildSiteSectionsUrl(config.supabaseUrl, pageSlug, sectionKey), {
      headers: restHeaders(config.anonKey),
    });
    if (!res.ok) {
      console.error(`[site] GET site_sections failed for ${pageSlug}/${sectionKey}: ${res.status}`);
      return null;
    }
    const rows = (await res.json()) as SiteSectionRow[];
    const row = rows[0];
    if (!row) return null;
    return {
      pageSlug: row.page_slug,
      sectionKey: row.section_key,
      displayOrder: row.display_order,
      fields: row.fields,
    };
  } catch (err) {
    console.error(`[site] GET site_sections errored for ${pageSlug}/${sectionKey}:`, err);
    return null;
  }
}

// Fetches every locale's content row for a page in one request (the
// `content` column is a whole-page JSON blob, not queryable per-section
// server-side) and indexes it by locale for resolveSectionValues.
export async function fetchContentByLocale(config: SupabaseRestConfig, pageSlug: string): Promise<ContentByLocale> {
  try {
    const res = await fetch(buildSiteContentUrl(config.supabaseUrl, pageSlug), {
      headers: restHeaders(config.anonKey),
    });
    if (!res.ok) {
      console.error(`[site] GET site_content failed for ${pageSlug}: ${res.status}`);
      return {};
    }
    const rows = (await res.json()) as SiteContentRow[];
    const byLocale: ContentByLocale = {};
    for (const row of rows) byLocale[row.locale] = row.content;
    return byLocale;
  } catch (err) {
    console.error(`[site] GET site_content errored for ${pageSlug}:`, err);
    return {};
  }
}

// Convenience entry point a section component calls with just its own
// section_key — fetches its schema + the page's content and resolves its
// own field values in one call. Resolves to `{}` (every field blank) if
// the schema row doesn't exist or either fetch failed, so a section
// component can render nothing for itself rather than throw.
export async function getSectionContent(
  config: SupabaseRestConfig,
  pageSlug: string,
  sectionKey: string,
  locale: string,
  canonicalLocale: string,
): Promise<SectionValues> {
  const [schema, contentByLocale] = await Promise.all([
    fetchSectionSchema(config, pageSlug, sectionKey),
    fetchContentByLocale(config, pageSlug),
  ]);
  if (!schema) return {};
  return resolveSectionValues(schema, contentByLocale, locale, canonicalLocale);
}

// ---------------------------------------------------------------------------
// Gallery-only Site Content read (ticket #23). See the NOTE near the top of
// this file for why this uses the supabase-js client instead of the
// SupabaseRestConfig/raw-fetch style above.
// ---------------------------------------------------------------------------

type GallerySiteContentRow = { content: Record<string, unknown> | null };

// Pure, DOM/network-free seam — the one vitest coverage ticket #23's
// acceptance criteria explicitly calls for. The gallery Site Content field
// (home/gallery/image_urls, localized: false) is stored as a single
// newline-separated textarea value (ticket #28's seed); this turns that
// raw string into a clean URL list, dropping blank/whitespace-only lines
// and trimming each remaining line.
export function parseImageUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Fetches one page's site_content row for `defaultLocale` and pulls the
// gallery section's image_urls field out of it. The gallery field is
// localized: false (ADR-0005) — its one value lives under the Tenant's
// canonical default-locale row and is read regardless of which locale the
// page currently renders, so this always queries `defaultLocale`, not the
// page's active locale. Never throws: a missing row or a Supabase error
// both resolve to an empty gallery (logged via console.error for the
// error case), mirroring apps/widget/src/lib/api/tenant-info.ts's
// fetchTenantInfo error-handling shape.
export async function fetchGalleryImageUrls(
  supabase: SupabaseClient,
  pageSlug: string,
  defaultLocale: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("site_content")
      .select("content")
      .eq("page_slug", pageSlug)
      .eq("locale", defaultLocale)
      .maybeSingle();

    if (error) {
      console.error(`[site] failed to fetch site_content for page "${pageSlug}":`, error);
      return [];
    }

    const row = data as GallerySiteContentRow | null;
    const gallery = row?.content?.gallery as Record<string, unknown> | undefined;
    const raw = gallery?.image_urls;
    return parseImageUrls(typeof raw === "string" ? raw : undefined);
  } catch (err) {
    console.error(`[site] errored fetching site_content for page "${pageSlug}":`, err);
    return [];
  }
}
