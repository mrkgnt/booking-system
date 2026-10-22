import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterServices } from "@/lib/catalog/filter";
import type { CatalogCategory, CatalogServiceEntry } from "@/lib/catalog/fetch";

// The one client-side-interactive island in the apps/site redesign
// (issue #24) — category-pill + search-box state live here; everything
// else on the page is server-rendered. Receives the full, already-
// localized catalog as props (fetched server-side in prices.astro via
// src/lib/catalog/fetch.ts) rather than fetching itself, so there's no
// client-side loading state to design around.

type Props = {
  categories: CatalogCategory[];
  services: CatalogServiceEntry[];
  allCategoriesLabel: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  fromPricePrefix: string;
  upToPricePrefix: string;
};

function formatPrice(service: CatalogServiceEntry, fromPricePrefix: string, upToPricePrefix: string): string {
  if (service.priceAmount == null) return "";
  const amount = new Intl.NumberFormat("lv-LV", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    service.priceAmount,
  );
  const formatted = `${amount} ${service.priceCurrency}`;
  if (service.pricePrefix === "from") return `${fromPricePrefix} ${formatted}`;
  if (service.pricePrefix === "up_to") return `${upToPricePrefix} ${formatted}`;
  return formatted;
}

export default function PriceList({
  categories,
  services,
  allCategoriesLabel,
  searchPlaceholder,
  noResultsLabel,
  fromPricePrefix,
  upToPricePrefix,
}: Props) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const visibleServices = useMemo(
    () => filterServices(services, { categoryId, search }),
    [services, categoryId, search],
  );

  const visibleByCategory = useMemo(() => {
    const map = new Map<string | null, CatalogServiceEntry[]>();
    for (const service of visibleServices) {
      const key = service.categoryId;
      const bucket = map.get(key);
      if (bucket) bucket.push(service);
      else map.set(key, [service]);
    }
    return map;
  }, [visibleServices]);

  const visibleCategories = categories.filter((category) => visibleByCategory.has(category.id));

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label={allCategoriesLabel}>
          <Button
            type="button"
            variant={categoryId === null ? "default" : "outline"}
            size="sm"
            aria-pressed={categoryId === null}
            onClick={() => setCategoryId(null)}
          >
            {allCategoriesLabel}
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              type="button"
              variant={categoryId === category.id ? "default" : "outline"}
              size="sm"
              aria-pressed={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {visibleCategories.length === 0 ? (
        <p className="text-muted-foreground">{noResultsLabel}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {visibleCategories.map((category) => (
            <div key={category.id} className="rounded-2xl border border-border/70 bg-card p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">{category.name}</h2>
              <ul className="divide-y divide-border/70">
                {(visibleByCategory.get(category.id) ?? []).map((service) => (
                  <li key={service.id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                    <span className="text-foreground/85">{service.name}</span>
                    <span className="font-medium whitespace-nowrap text-primary">
                      {formatPrice(service, fromPricePrefix, upToPricePrefix)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
