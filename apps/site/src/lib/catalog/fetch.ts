// Server-side read of the real catalog (service_categories/services,
// translated via the shared `translations` table) for the price-list
// section (issue #24). Direct Supabase REST with the anon key — the same
// public-catalog-read pattern apps/admin/apps/widget already use (scoped
// GRANT+RLS on exactly these tables, see db/tenant-schema.sql's "PUBLIC
// CATALOG READ ACCESS" section) — not proxied through apps/api, since
// apps/site is a per-tenant deployment with its own Supabase credentials
// (unlike apps/widget's shared deployment, which has none).
//
// Deliberately generic: reads whatever rows actually exist in
// service_categories/services, real or still-Faker-placeholder (ticket
// #26 may replace the data concurrently) — nothing here assumes specific
// names/shapes beyond the schema itself.

import type { CatalogService } from "./filter.js";

export type CatalogCategory = {
  id: string;
  icon: string | null;
  displayOrder: number;
  name: string;
};

export type CatalogServiceEntry = CatalogService & {
  displayOrder: number;
  priceAmount: number | null;
  priceCurrency: string;
  pricePrefix: "exact" | "from" | "up_to";
};

export type Catalog = {
  categories: CatalogCategory[];
  services: CatalogServiceEntry[];
};

type RawCategory = { id: string; icon: string | null; display_order: number };
type RawService = {
  id: string;
  category_id: string | null;
  display_order: number;
  price_amount: number | null;
  price_currency: string;
  price_prefix: string;
};
type RawTranslation = { entity_type: string; entity_id: string; locale: string; field: string; value: string };

async function restGet<T>(supabaseUrl: string, anonKey: string, path: string): Promise<T[] | null> {
  const base = supabaseUrl.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!res.ok) {
      console.error(`[site] Supabase REST GET "${path}" failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as T[];
  } catch (err) {
    console.error(`[site] Supabase REST GET "${path}" errored:`, err);
    return null;
  }
}

// Mirrors apps/api's resolveLocale (tenant-info.ts/booking-lookup.ts) —
// locale, then defaultLocale, then whatever's present. Reimplemented here
// rather than shared, same accepted duplication already logged for those
// two call sites (see CLAUDE.md's Open Items).
function resolveTranslation(
  rows: RawTranslation[],
  entityType: string,
  entityId: string,
  field: string,
  locale: string,
  defaultLocale: string,
): string {
  let localeValue: string | undefined;
  let defaultValue: string | undefined;
  let anyValue: string | undefined;
  for (const row of rows) {
    if (row.entity_type !== entityType || row.entity_id !== entityId || row.field !== field) continue;
    if (anyValue === undefined) anyValue = row.value;
    if (row.locale === locale) localeValue = row.value;
    if (row.locale === defaultLocale) defaultValue = row.value;
  }
  return localeValue ?? defaultValue ?? anyValue ?? "";
}

// `defaultLocale` is apps/site's own i18n default ("lv", astro.config.mjs)
// rather than a `business_profile.default_locale` read — business_profile
// isn't one of the anon-granted catalog tables, and apps/site's supported
// locales are already fixed at build time (the existing content/*.ts
// files), so there's no live config to fall back to here.
export async function fetchCatalog(
  supabaseUrl: string,
  anonKey: string,
  locale: string,
  defaultLocale = "lv",
): Promise<Catalog | null> {
  const [categoriesRaw, servicesRaw, translationsRaw] = await Promise.all([
    restGet<RawCategory>(
      supabaseUrl,
      anonKey,
      "service_categories?select=id,icon,display_order&is_active=eq.true&order=display_order.asc",
    ),
    restGet<RawService>(
      supabaseUrl,
      anonKey,
      "services?select=id,category_id,display_order,price_amount,price_currency,price_prefix&is_active=eq.true&order=display_order.asc",
    ),
    restGet<RawTranslation>(
      supabaseUrl,
      anonKey,
      "translations?select=entity_type,entity_id,locale,field,value&entity_type=in.(service,service_category)",
    ),
  ]);

  if (!categoriesRaw || !servicesRaw || !translationsRaw) return null;

  const categories: CatalogCategory[] = categoriesRaw.map((c) => ({
    id: c.id,
    icon: c.icon,
    displayOrder: c.display_order,
    name: resolveTranslation(translationsRaw, "service_category", c.id, "name", locale, defaultLocale),
  }));

  const services: CatalogServiceEntry[] = servicesRaw.map((s) => ({
    id: s.id,
    categoryId: s.category_id,
    displayOrder: s.display_order,
    priceAmount: s.price_amount,
    priceCurrency: s.price_currency,
    pricePrefix: s.price_prefix as CatalogServiceEntry["pricePrefix"],
    name: resolveTranslation(translationsRaw, "service", s.id, "name", locale, defaultLocale),
  }));

  return { categories, services };
}
