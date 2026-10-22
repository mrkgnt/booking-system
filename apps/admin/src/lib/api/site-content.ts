import { apiFetch, type ApiClientConfig } from "./client.js";

// Mirrors apps/api's SiteSectionField (apps/api/src/lib/site-content.ts) —
// the developer-owned schema shape for one field of one Section (ADR-0005).
export type SiteSectionField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "image";
  required: boolean;
  localized: boolean;
};

// Matches GET /admin/site-sections's row shape (select("*") on
// site_sections) — see apps/api/src/routes/admin-site-sections.ts.
export type SiteSection = {
  id: string;
  page_slug: string;
  section_key: string;
  display_order: number;
  fields: SiteSectionField[];
  created_at: string;
};

export async function listSiteSections(config: ApiClientConfig, page: string): Promise<SiteSection[]> {
  const { sections } = await apiFetch<{ sections: SiteSection[] }>(
    config,
    `/admin/site-sections?page=${encodeURIComponent(page)}`,
  );
  return sections;
}

// { [sectionKey]: { [fieldKey]: value } } — matches site_content.content
// (and GET/PUT /admin/site-content's resolved `content` shape).
export type SiteContentValue = Record<string, Record<string, string>>;

export type SiteContent = { pageSlug: string; locale: string; content: SiteContentValue };

export async function getSiteContent(config: ApiClientConfig, page: string, locale: string): Promise<SiteContent> {
  const { siteContent } = await apiFetch<{ siteContent: SiteContent }>(
    config,
    `/admin/site-content?page=${encodeURIComponent(page)}&locale=${encodeURIComponent(locale)}`,
  );
  return siteContent;
}

export async function saveSiteContent(
  config: ApiClientConfig,
  page: string,
  locale: string,
  content: SiteContentValue,
): Promise<SiteContent> {
  const { siteContent } = await apiFetch<{ siteContent: SiteContent }>(config, "/admin/site-content", {
    method: "PUT",
    body: JSON.stringify({ page, locale, content }),
  });
  return siteContent;
}
