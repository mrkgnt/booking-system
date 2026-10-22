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
    intro: "Below are our most common services and prices. The full price list is available at the clinic during a consultation.",
    categories: [
      {
        name: "Consultations",
        items: [
          { label: "Initial consultation (examination, X-ray, treatment plan)", price: "€64.00" },
          { label: "Follow-up consultation", price: "€25.00" },
          { label: "Drawing up a treatment plan", price: "€50.00" },
        ],
      },
      {
        name: "Hygiene",
        items: [
          { label: "Complete oral hygiene with instruction", price: "€70.00" },
          { label: "Removal of soft plaque and polishing (all teeth)", price: "€40.00" },
          { label: "Fissure sealant coating (one tooth)", price: "€8.00" },
        ],
      },
      {
        name: "Therapy",
        items: [
          { label: "Composite filling (one surface)", price: "€90.00" },
          { label: "Composite filling (more than three surfaces)", price: "€195.00" },
          { label: "Root canal treatment (single canal)", price: "€88.00" },
        ],
      },
      {
        name: "Prosthetics",
        items: [
          { label: "Full zirconia crown", price: "€650.00" },
          { label: "E.MAX ceramic crown", price: "€520.00" },
          { label: "Complete denture", price: "from €800.00" },
        ],
      },
      {
        name: "Dental surgery",
        items: [
          { label: "Single-root tooth extraction", price: "€120.00" },
          { label: "Single implant placement (Straumann)", price: "€800.00" },
          { label: "Bone transplantation", price: "from €800.00" },
        ],
      },
      {
        name: "Orthodontics",
        items: [
          { label: "Ordoline aligners (Easy)", price: "€1,490.00" },
          { label: "Ordoline aligners (Complex)", price: "€3,400.00" },
          { label: "Orthodontic retainer plate", price: "from €200.00" },
        ],
      },
    ],
    note: "Exact treatment-plan pricing is confirmed after an individual consultation.",
  },
  footer: { rights: "All rights reserved.", backToTop: "Back to top" },
  findUs: {
    heading: "Find us",
    mapsLabel: "Open Google Maps",
    wazeLabel: "Drive with Waze",
  },
};
