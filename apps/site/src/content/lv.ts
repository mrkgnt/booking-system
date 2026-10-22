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
      "Zemāk apskatāmi visi mūsu pakalpojumi ar cenām. Izmantojiet kategoriju filtrus vai meklēšanu, lai ātri atrastu nepieciešamo.",
    searchPlaceholder: "Meklēt pakalpojumu...",
    allCategoriesLabel: "Visi",
    noResultsLabel: "Nav atrasts neviens pakalpojums.",
    unavailableLabel: "Cenrādis šobrīd nav pieejams. Lūdzu, apmeklējiet vēlāk.",
    fromPricePrefix: "no",
    upToPricePrefix: "līdz",
    note: "Precīzas izmaksas ārstēšanas plānam tiek noteiktas pēc individuālas konsultācijas.",
  },
  footer: { rights: "Visas tiesības aizsargātas." },
};
