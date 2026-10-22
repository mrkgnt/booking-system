import type { SiteCopy } from "./types";

export const en: SiteCopy = {
  nav: { home: "Home", prices: "Price List", bookNow: "Book an appointment" },
  hero: {
    since: "Our clinic has been welcoming patients since 2003.",
    title: "We care about the health and beauty of your teeth",
    subtitle:
      "Dent Di offers a wide range of dental services — from a simple tooth filling to a complete bite restoration.",
    callUs: "Call us!",
    cta: "Book an appointment",
  },
  about: {
    heading: "About us",
    paragraphs: [
      "The Dent Di clinic was founded in 2003. Since the very first day, our goal has been to help patients solve the issues of dental health and aesthetics at the highest professional level.",
      "Today, Dent Di offers a wide range of services — from relatively easy manipulations, such as filling a tooth in the volume of one surface, to more complex works, including a complete bite restoration with reconstruction of the lost dental height, often requiring comprehensive treatment involving implants and prosthetics.",
    ],
    quote: [
      "Dentistry is my inspiration, an opportunity to serve the world by increasing the number of smiling people around us. With deep respect and love for every patient of mine.",
    ],
    doctorName: "Dr. Dina Gnitecka",
  },
  team: [
    { name: "Dina Gnitecka", role: "Dentist", credential: "Rīga Stradiņš University, Faculty of Dentistry" },
    { name: "Olga Chursinova", role: "Medical Nurse", credential: "Riga Medical School #4" },
  ],
  hours: {
    heading: "Working hours",
    rows: [
      { day: "Monday", hours: "10:30–18:00 or closed" },
      { day: "Tuesday", hours: "10:30–18:00" },
      { day: "Wednesday", hours: "10:30–18:00" },
      { day: "Thursday", hours: "10:30–18:00" },
      { day: "Friday", hours: "10:30–18:00" },
      { day: "Saturday", hours: "Closed" },
      { day: "Sunday", hours: "Closed" },
    ],
  },
  contact: {
    heading: "Contact information",
    addressLines: ["Zirņu iela 8-60,", "Vidzemes priekšpilsēta,", "Rīga"],
    email: "info@dentdi.lv",
    phone: "+371 29518615",
  },
  pricesPage: {
    title: "Price List",
    intro: "Below are all of our services and prices. Use the category filters or search to quickly find what you need.",
    searchPlaceholder: "Search services...",
    allCategoriesLabel: "All",
    noResultsLabel: "No services found.",
    unavailableLabel: "The price list is temporarily unavailable. Please check back later.",
    fromPricePrefix: "from",
    upToPricePrefix: "up to",
    note: "Exact treatment-plan pricing is confirmed after an individual consultation.",
  },
  footer: { rights: "All rights reserved." },
};
