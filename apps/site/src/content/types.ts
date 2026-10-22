export type Locale = "lv" | "ru" | "en";

export type PriceItem = { label: string; price: string };
export type PriceCategory = { name: string; items: PriceItem[] };

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
    categories: PriceCategory[];
    note: string;
  };
  footer: { rights: string; backToTop: string };
  // "Find us" band (issue #25): Maps/Waze links are built at render time
  // from business_profile.address, not a Site Content field — only these
  // chrome labels (heading/button text) live here, same as every other
  // structural UI string in this file.
  findUs: { heading: string; mapsLabel: string; wazeLabel: string };
};
