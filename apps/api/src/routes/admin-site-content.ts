import { Hono } from "hono";
import type { Json } from "../lib/database.types.js";
import { classifySupabaseError } from "../lib/pg-errors.js";
import {
  findMissingRequiredFields,
  mergeLocalizedContent,
  splitContentByLocalization,
  type SiteContentValue,
  type SiteSectionRow,
} from "../lib/site-content.js";
import type { TypedSupabaseClient } from "../lib/supabase.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { siteContentBodySchema, siteContentQuerySchema } from "./admin-site-content.schema.js";

export const adminSiteContentRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

// Resolves the Tenant's canonical locale for `localized: false` fields —
// same business_profile.default_locale precedent as admin-me.ts's
// resolveCustomerLabel() / booking-lookup.ts's defaultLocale fallback.
async function getDefaultLocale(supabase: TypedSupabaseClient, fallback: string): Promise<string> {
  const { data: businessProfile } = await supabase.from("business_profile").select("default_locale").maybeSingle();
  return businessProfile?.default_locale ?? fallback;
}

type SiteContentRow = { page_slug: string; locale: string; content: Json; created_at: string; updated_at: string };

async function getStoredContent(
  supabase: TypedSupabaseClient,
  pageSlug: string,
  locale: string,
): Promise<{ content: SiteContentValue; error: { code?: string | null; message?: string | null } | null }> {
  const { data, error } = await supabase
    .from("site_content")
    .select("content")
    .eq("page_slug", pageSlug)
    .eq("locale", locale)
    .maybeSingle();
  return { content: (data?.content as SiteContentValue | null) ?? {}, error };
}

async function upsertSiteContent(
  supabase: TypedSupabaseClient,
  pageSlug: string,
  locale: string,
  content: SiteContentValue,
): Promise<{ row: SiteContentRow | null; error: { code?: string | null; message?: string | null } | null }> {
  const { data, error } = await supabase
    .from("site_content")
    .upsert({ page_slug: pageSlug, locale, content: content as unknown as Json }, { onConflict: "page_slug,locale" })
    .select("*")
    .single();
  return { row: (data as SiteContentRow | null) ?? null, error };
}

adminSiteContentRoute.get("/admin/site-content", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = siteContentQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const { page, locale } = parsed.data;
  const supabase = c.get("supabaseUser");

  const defaultLocale = await getDefaultLocale(supabase, locale);

  const own = await getStoredContent(supabase, page, locale);
  if (own.error) {
    const { httpStatus, body } = classifySupabaseError(own.error);
    return c.json(body, httpStatus as 409 | 500);
  }

  let mergedContent = own.content;
  if (locale !== defaultLocale) {
    const canonical = await getStoredContent(supabase, page, defaultLocale);
    if (canonical.error) {
      const { httpStatus, body } = classifySupabaseError(canonical.error);
      return c.json(body, httpStatus as 409 | 500);
    }
    mergedContent = mergeLocalizedContent(canonical.content, own.content);
  }

  return c.json({
    siteContent: { pageSlug: page, locale, content: mergedContent },
  });
});

adminSiteContentRoute.put("/admin/site-content", tenantMiddleware, staffAuthMiddleware, async (c): Promise<Response> => {
  const json = await c.req.json().catch(() => null);
  const parsed = siteContentBodySchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const { page, locale, content } = parsed.data;
  const submittedContent = content as SiteContentValue;
  const supabase = c.get("supabaseUser");

  const { data: sections, error: sectionsError } = await supabase
    .from("site_sections")
    .select("section_key, fields")
    .eq("page_slug", page);
  if (sectionsError) {
    const { httpStatus, body } = classifySupabaseError(sectionsError);
    return c.json(body, httpStatus as 409 | 500);
  }
  const sectionRows = (sections ?? []) as unknown as SiteSectionRow[];

  const missingFields = findMissingRequiredFields(sectionRows, submittedContent);
  if (missingFields.length > 0) {
    return c.json(
      { error: "validation_error", details: missingFields.map((field) => ({ field, message: "required" })) },
      400,
    );
  }

  const defaultLocale = await getDefaultLocale(supabase, locale);
  const { ownLocale, canonical } = splitContentByLocalization(sectionRows, submittedContent);

  // Default locale: own-locale and canonical fields both live in the same
  // row, so merge them before one upsert.
  if (locale === defaultLocale) {
    const existing = await getStoredContent(supabase, page, locale);
    const nextContent = mergeLocalizedContent(existing.content, mergeLocalizedContent(canonical, ownLocale));

    const saved = await upsertSiteContent(supabase, page, locale, nextContent);
    if (saved.error || !saved.row) {
      const { httpStatus, body } = classifySupabaseError(saved.error ?? {});
      return c.json(body, httpStatus as 409 | 500);
    }
    return c.json({
      siteContent: { pageSlug: saved.row.page_slug, locale: saved.row.locale, content: saved.row.content },
    });
  }

  // Non-default locale: own-locale fields go to this locale's row;
  // localized:false fields go to the canonical (default-locale) row
  // instead, regardless of which locale is being edited (ADR-0005).
  const existingOwn = await getStoredContent(supabase, page, locale);
  const nextOwnContent = mergeLocalizedContent(existingOwn.content, ownLocale);

  const savedOwn = await upsertSiteContent(supabase, page, locale, nextOwnContent);
  if (savedOwn.error || !savedOwn.row) {
    const { httpStatus, body } = classifySupabaseError(savedOwn.error ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }

  let nextCanonicalContent: SiteContentValue = canonical;
  if (Object.keys(canonical).length > 0) {
    const existingCanonical = await getStoredContent(supabase, page, defaultLocale);
    nextCanonicalContent = mergeLocalizedContent(existingCanonical.content, canonical);
    const savedCanonical = await upsertSiteContent(supabase, page, defaultLocale, nextCanonicalContent);
    if (savedCanonical.error) {
      const { httpStatus, body } = classifySupabaseError(savedCanonical.error);
      return c.json(body, httpStatus as 409 | 500);
    }
  }

  const effectiveContent = mergeLocalizedContent(nextCanonicalContent, nextOwnContent);
  return c.json({ siteContent: { pageSlug: page, locale, content: effectiveContent } });
});
