import type { SiteCopy } from "./types";

export const lv: SiteCopy = {
  nav: { home: "Sākums", prices: "Cenrādis", bookNow: "Pieraksties" },
  hero: {
    since: "Mūsu durvis jums ir atvērtas kopš 2003. gada.",
    title: "Mēs rūpējamies par jūsu zobu veselību un skaistumu",
    subtitle:
      "Klīnika Dent Di piedāvā visdažādākos stomatoloģijas pakalpojumus — no vienkāršas zoba plombēšanas līdz sarežģītai sakodiena atjaunošanai.",
    callUs: "Zvaniet mums!",
    cta: "Pieraksties vizītei",
  },
  about: {
    heading: "Par mums",
    paragraphs: [
      "Klīnika Dent Di tika dibināta 2003. gadā. No pašas pirmās dienas mērķis bija sniegt palīdzību pacientiem, risinot zobu veselības un estētikas jautājumus maksimāli augstā līmenī.",
      "Šodien Dent Di piedāvā visdažādākos pakalpojumus — sākot ar samērā vieglām manipulācijām, piemēram, zoba plombēšanu vienas virsmas apjomā, un turpinot ar sarežģītākām: sakodiena pilnu restaurāciju ar pazaudētā augstuma atjaunošanu, bieži kompleksā ārstēšanā ar implantu ievadīšanu un protezēšanu.",
    ],
    quote: [
      "Stomatoloģija ir mana iedvesma, mana iespēja kalpot pasaulei, palielinot smaidošo cilvēku skaitu. Ar dziļu cieņu un mīlestību pret katru manu pacientu.",
    ],
    doctorName: "Dr. Dina Gnitecka",
  },
  team: [
    { name: "Dina Gnitecka", role: "Stomatologs", credential: "Latvijas Medicīnas Akadēmija (Rīgas Stradiņa Universitāte)" },
    { name: "Olga Čursinova", role: "Medicīnas māsa", credential: "Rīgas 4. medicīnas skola" },
  ],
  hours: {
    heading: "Darba stundas",
    rows: [
      { day: "Pirmdiena", hours: "10:30–18:00 vai slēgts" },
      { day: "Otrdiena", hours: "10:30–18:00" },
      { day: "Trešdiena", hours: "10:30–18:00" },
      { day: "Ceturtdiena", hours: "10:30–18:00" },
      { day: "Piektdiena", hours: "10:30–18:00" },
      { day: "Sestdiena", hours: "Slēgts" },
      { day: "Svētdiena", hours: "Slēgts" },
    ],
  },
  contact: {
    heading: "Kontakta informācija",
    addressLines: ["Zirņu iela 8-60,", "Vidzemes priekšpilsēta,", "Rīga"],
    email: "info@dentdi.lv",
    phone: "+371 29518615",
  },
  pricesPage: {
    title: "Cenrādis",
    intro:
      "Zemāk apskatāmi mūsu populārākie pakalpojumi ar cenām. Pilns cenrādis pieejams klīnikā konsultācijas laikā.",
    categories: [
      {
        name: "Konsultācijas",
        items: [
          { label: "Pirmreizējā konsultācija (apskate, RTG, ārstēšanas plāns)", price: "64,00 €" },
          { label: "Atkārtota konsultācija", price: "25,00 €" },
          { label: "Ārstēšanas plāna sastādīšana", price: "50,00 €" },
        ],
      },
      {
        name: "Mutes dobuma higiēna",
        items: [
          { label: "Pilna mutes dobuma higiēna ar instruktāžu", price: "70,00 €" },
          { label: "Mīksta aplikuma noņemšana ar pulēšanu (visiem zobiem)", price: "40,00 €" },
          { label: "Zoba pārklāšana ar emalju hermetizējošo šķidrumu (vienam zobam)", price: "8,00 €" },
        ],
      },
      {
        name: "Terapija",
        items: [
          { label: "Plombēšana ar kompozītmateriālu (vienas virsmas apjomā)", price: "90,00 €" },
          { label: "Plombēšana ar kompozītmateriālu (vairāk par trim virsmām)", price: "195,00 €" },
          { label: "Kanāla apstrāde (viens kanāls)", price: "88,00 €" },
        ],
      },
      {
        name: "Protezēšana",
        items: [
          { label: "Cirkonija kronis (full)", price: "650,00 €" },
          { label: "Porcelāna kronis (E.MAX)", price: "520,00 €" },
          { label: "Totāla izņemamā protēze", price: "no 800,00 €" },
        ],
      },
      {
        name: "Mutes ķirurģija",
        items: [
          { label: "Viensakņu zoba ekstrakcija", price: "120,00 €" },
          { label: "Viena implanta ievadīšana (Straumann)", price: "800,00 €" },
          { label: "Kaula transplantācija", price: "no 800,00 €" },
        ],
      },
      {
        name: "Ortodontija",
        items: [
          { label: "Zobu taisnošana ar ORDOLINE kapēm (Easy)", price: "1490,00 €" },
          { label: "Zobu taisnošana ar ORDOLINE kapēm (Complex)", price: "3400,00 €" },
          { label: "Zobu regulācijas ortodontiska plate", price: "no 200,00 €" },
        ],
      },
    ],
    note: "Precīzas izmaksas ārstēšanas plānam tiek noteiktas pēc individuālas konsultācijas.",
  },
  footer: { rights: "Visas tiesības aizsargātas." },
};
