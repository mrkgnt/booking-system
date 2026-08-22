import type { TypedSupabaseClient } from "./supabase.js";

// Generic i18n storage helpers for the shared `translations` table (see
// db/tenant-schema.sql) — every admin CRUD route that edits a translatable
// entity (service_categories, services, staff) goes through these instead
// of hand-rolling the same upsert/fetch/delete shape three times.

export type TranslationInput = { locale: string; field: string; value: string };
export type TranslationRow = { locale: string; field: string; value: string };

export async function upsertTranslations(
  supabase: TypedSupabaseClient,
  entityType: string,
  entityId: string,
  translations: TranslationInput[],
): Promise<void> {
  if (translations.length === 0) return;
  await supabase.from("translations").upsert(
    translations.map((t) => ({
      entity_type: entityType,
      entity_id: entityId,
      locale: t.locale,
      field: t.field,
      value: t.value,
    })),
    { onConflict: "entity_type,entity_id,locale,field" },
  );
}

export async function fetchTranslations(
  supabase: TypedSupabaseClient,
  entityType: string,
  entityId: string,
): Promise<TranslationRow[]> {
  const { data } = await supabase
    .from("translations")
    .select("locale, field, value")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  return data ?? [];
}

export async function deleteTranslations(
  supabase: TypedSupabaseClient,
  entityType: string,
  entityId: string,
): Promise<void> {
  await supabase.from("translations").delete().eq("entity_type", entityType).eq("entity_id", entityId);
}

// Reshapes fetchTranslations()'s row list into the { locale: value } map
// every admin CRUD route (Tasks 12-14) both accepts on write and returns
// on read — keeps GET/POST/PATCH responses for the same resource shaped
// identically instead of round-tripping the raw {locale, field, value} rows.
export function toLocaleMap(rows: TranslationRow[], field: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.field === field) {
      map[row.locale] = row.value;
    }
  }
  return map;
}
