export type Locale = "lv" | "ru" | "en";

export type SiteCopy = {
  nav: { home: string; prices: string; bookNow: string };
  hero: { since: string; title: string; subtitle: string; callUs: string; cta: string };
  about: {
    heading: string;
    paragraphs: string[];
    quote: string[];
    doctorName: string;
  };
  team: Array<{ name: string; role: string; credential: string }>;
  hours: { heading: string; rows: Array<{ day: string; hours: string }> };
  contact: { heading: string; addressLines: string[]; email: string; phone: string };
  pricesPage: {
    title: string;
    intro: string;
    // The actual price list (categories + services) is no longer curated
    // content here — it's read live from service_categories/services via
    // PriceList's server-side fetch (issue #24). Only the page's static
    // chrome strings stay in this file.
    searchPlaceholder: string;
    allCategoriesLabel: string;
    noResultsLabel: string;
    unavailableLabel: string;
    // Prefixed in front of a service's price when price_prefix is "from"/
    // "up_to" (db/tenant-schema.sql) — e.g. "from 64,00 €" / "no 64,00 €".
    fromPricePrefix: string;
    upToPricePrefix: string;
    note: string;
  };
  footer: { rights: string };
};
