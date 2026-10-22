// Pure filter/search logic for the price-list island (issue #24) — kept
// free of the DOM/React so it's testable on its own, per the ticket's
// explicit ask. The island (PriceList.tsx) owns the category-pill +
// search-box state and calls this on every change.

export type CatalogService = {
  id: string;
  categoryId: string | null;
  name: string;
};

export type CatalogFilter = {
  categoryId?: string | null;
  search?: string;
};

// Generic over T so callers with a richer service shape (e.g.
// CatalogServiceEntry in fetch.ts, which adds price fields) get that
// shape back out, not the narrowed base CatalogService.
export function filterServices<T extends CatalogService>(services: T[], filter: CatalogFilter): T[] {
  const { categoryId, search } = filter;
  const term = search?.trim().toLowerCase() ?? "";

  return services.filter((service) => {
    if (categoryId && service.categoryId !== categoryId) return false;
    if (term && !service.name.toLowerCase().includes(term)) return false;
    return true;
  });
}
