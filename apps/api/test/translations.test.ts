import { describe, expect, it, vi } from "vitest";
import { deleteTranslations, fetchTranslations, toLocaleMap, upsertTranslations } from "../src/lib/translations.js";

// A hand-rolled fake standing in for TypedSupabaseClient's fluent builder —
// enough of the chain shape to prove each helper calls the right methods
// with the right arguments, without touching a live Supabase project.
function makeFakeSupabase() {
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });

  const selectEq2 = vi.fn().mockResolvedValue({
    data: [{ locale: "en", field: "name", value: "Cleaning" }],
    error: null,
  });
  const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
  const select = vi.fn().mockReturnValue({ eq: selectEq1 });

  const deleteEq2 = vi.fn().mockResolvedValue({ data: null, error: null });
  const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
  const del = vi.fn().mockReturnValue({ eq: deleteEq1 });

  const from = vi.fn().mockReturnValue({ upsert, select, delete: del });

  return { from, upsert, select, selectEq1, selectEq2, del, deleteEq1, deleteEq2 };
}

describe("upsertTranslations", () => {
  it("does nothing and makes no call when given an empty array", async () => {
    const supabase = makeFakeSupabase();
    await upsertTranslations(supabase as never, "service", "svc-1", []);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("upserts one row per translation against the composite conflict target", async () => {
    const supabase = makeFakeSupabase();
    await upsertTranslations(supabase as never, "service", "svc-1", [
      { locale: "en", field: "name", value: "Cleaning" },
      { locale: "lv", field: "name", value: "Tīrīšana" },
    ]);
    expect(supabase.from).toHaveBeenCalledWith("translations");
    expect(supabase.upsert).toHaveBeenCalledWith(
      [
        { entity_type: "service", entity_id: "svc-1", locale: "en", field: "name", value: "Cleaning" },
        { entity_type: "service", entity_id: "svc-1", locale: "lv", field: "name", value: "Tīrīšana" },
      ],
      { onConflict: "entity_type,entity_id,locale,field" },
    );
  });
});

describe("fetchTranslations", () => {
  it("filters by entity_type and entity_id and returns the rows", async () => {
    const supabase = makeFakeSupabase();
    const result = await fetchTranslations(supabase as never, "service", "svc-1");
    expect(supabase.from).toHaveBeenCalledWith("translations");
    expect(supabase.select).toHaveBeenCalledWith("locale, field, value");
    expect(supabase.selectEq1).toHaveBeenCalledWith("entity_type", "service");
    expect(supabase.selectEq2).toHaveBeenCalledWith("entity_id", "svc-1");
    expect(result).toEqual([{ locale: "en", field: "name", value: "Cleaning" }]);
  });

  it("returns an empty array when the query returns null data", async () => {
    const supabase = makeFakeSupabase();
    supabase.selectEq2.mockResolvedValueOnce({ data: null, error: null });
    const result = await fetchTranslations(supabase as never, "service", "svc-1");
    expect(result).toEqual([]);
  });
});

describe("deleteTranslations", () => {
  it("deletes by entity_type and entity_id", async () => {
    const supabase = makeFakeSupabase();
    await deleteTranslations(supabase as never, "service", "svc-1");
    expect(supabase.from).toHaveBeenCalledWith("translations");
    expect(supabase.deleteEq1).toHaveBeenCalledWith("entity_type", "service");
    expect(supabase.deleteEq2).toHaveBeenCalledWith("entity_id", "svc-1");
  });
});

describe("toLocaleMap", () => {
  it("keeps only rows matching the given field, keyed by locale", () => {
    const result = toLocaleMap(
      [
        { locale: "en", field: "name", value: "Cleaning" },
        { locale: "lv", field: "name", value: "Tīrīšana" },
        { locale: "en", field: "description", value: "A routine cleaning" },
      ],
      "name",
    );
    expect(result).toEqual({ en: "Cleaning", lv: "Tīrīšana" });
  });

  it("returns an empty object when no rows match the field", () => {
    expect(toLocaleMap([{ locale: "en", field: "description", value: "x" }], "name")).toEqual({});
  });
});
