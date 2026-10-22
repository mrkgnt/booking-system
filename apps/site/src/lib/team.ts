import type { SupabaseClient } from "@supabase/supabase-js";

const STAFF_ENTITY_TYPE = "staff";

export type TeamMember = {
  id: string;
  name: string;
  photoUrl: string | null;
  bio: string;
  displayOrder: number;
};

// Duplicated deliberately, not imported — apps/api/src/routes/
// tenant-info.ts has the same resolveLocale shape; this repo's accepted
// precedent (see CLAUDE.md's Decisions Log) is to repeat this ~5-line
// helper at each of its few call sites rather than add a cross-app shared
// package for it.
function resolveLocale(localeMap: Record<string, string>, locale: string, defaultLocale: string): string {
  if (localeMap[locale] !== undefined) return localeMap[locale];
  if (localeMap[defaultLocale] !== undefined) return localeMap[defaultLocale];
  const [firstAvailable] = Object.values(localeMap);
  return firstAvailable ?? "";
}

// Reads the existing `staff` table directly (no new schema, per ticket
// #23's acceptance criteria) — `name`/`photo_url`/`display_order` are
// plain columns, `bio` is the one localized free-text field (translations
// table, same as apps/admin's admin-staff.ts reads/writes) used here as
// the descriptive line under each team member's name. Generic against
// whatever's actually in the staff table — no hardcoded names, since the
// live Dent Di staff rows are still Faker placeholders as of this ticket
// (a separate, already-flagged data issue).
//
// Never throws: a Supabase error on either query logs via console.error
// and the function degrades to an empty team list, so a transient read
// failure makes the Team section render nothing rather than crash the
// page (mirrors apps/widget/src/lib/api/tenant-info.ts's fetchTenantInfo
// shape).
export async function fetchTeam(
  supabase: SupabaseClient,
  locale: string,
  defaultLocale: string,
): Promise<TeamMember[]> {
  const { data: staffRows, error: staffError } = await supabase
    .from("staff")
    .select("id, name, photo_url, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (staffError) {
    console.error("[site] failed to fetch staff for Team section:", staffError);
    return [];
  }
  if (!staffRows || staffRows.length === 0) return [];

  const { data: translationRows, error: translationError } = await supabase
    .from("translations")
    .select("entity_id, locale, value")
    .eq("entity_type", STAFF_ENTITY_TYPE)
    .eq("field", "bio")
    .in(
      "entity_id",
      staffRows.map((row) => row.id),
    );

  if (translationError) {
    console.error("[site] failed to fetch staff bios for Team section:", translationError);
  }

  const bioByStaffId = new Map<string, Record<string, string>>();
  for (const row of translationRows ?? []) {
    const map = bioByStaffId.get(row.entity_id) ?? {};
    map[row.locale] = row.value;
    bioByStaffId.set(row.entity_id, map);
  }

  return staffRows.map((row) => ({
    id: row.id,
    name: row.name,
    photoUrl: row.photo_url,
    displayOrder: row.display_order,
    bio: resolveLocale(bioByStaffId.get(row.id) ?? {}, locale, defaultLocale),
  }));
}
