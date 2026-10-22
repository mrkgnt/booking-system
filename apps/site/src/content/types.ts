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
  footer: { rights: string };
};
