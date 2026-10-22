import type { SupabaseClient } from "@supabase/supabase-js";

// Minimal public Site Content read (ADR-0005) scoped to what the Gallery
// section needs. apps/site doesn't yet have a shared Site Content read
// helper on this branch (ticket #22, which the parent spec #18 describes as
// also building one for hero/about/stats/testimonial, hasn't merged into
// site-cms-integration as of this ticket) — written minimally here per
// ticket #23's own instructions, to be reconciled/deduped against #22's at
// merge time rather than blocking on it.

type SiteContentRow = { content: Record<string, unknown> | null };

// Pure, DOM/network-free seam — the one vitest coverage this ticket's
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

    const row = data as SiteContentRow | null;
    const gallery = row?.content?.gallery as Record<string, unknown> | undefined;
    const raw = gallery?.image_urls;
    return parseImageUrls(typeof raw === "string" ? raw : undefined);
  } catch (err) {
    console.error(`[site] errored fetching site_content for page "${pageSlug}":`, err);
    return [];
  }
}
