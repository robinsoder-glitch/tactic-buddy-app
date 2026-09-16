/** Regelbok för spelare 5–10 år. Våra egna texter – enkelt språk, korta stycken. */
export type RuleEntry = {
  /** Paragrafnummer inom kapitlet, t.ex. "1" i "§ 2.1". */
  number: number;
  title: string;
  text: string;
};

export type RuleChapter = {
  number: number;
  title: string;
  intro: string;
  rules: RuleEntry[];
};

export const PLAYER_RULEBOOK: RuleChapter[] = [
  {
    number: 1,
    title: "Så går en match till",
    intro: "Här får du veta hur länge ni spelar, vad domaren gör och när en match är slut.",
    rules: [
      {
        number: 1,
        title: "Två halvlekar",
        text: "En match är uppdelad i två halvlekar med ett uppehåll i mitten som heter halvtid. Då vilar man, dricker vatten och tränaren kan säga några bra saker.",
      },
      {
        number: 2,
        title: "Domaren bestämmer",
        text: "Domaren är den som blåser i visselpipan och startar och stoppar matchen. Det domaren säger gäller, även om man tycker något annat.",
      },
      {
        number: 3,
        title: "Mest mål vinner",
        text: "Det lag som gör flest mål vinner matchen. Blir det lika många mål blir det oavgjort – då får båda lagen vara lite nöjda.",
      },
    ],
  },
  {
    number: 2,
    title: "Bollen – in och ut",
    intro: "Bollen räknas bara som ute när HELA bollen har passerat linjen.",
    rules: [
      {
        number: 1,
        title: "Inkast",
        text: "Går bollen ut över långsidan får det lag som inte rörde bollen sist kasta in den igen. Båda händerna håller i bollen, bollen kastas över huvudet och båda fötterna ska vara i backen.",
      },
      {
        number: 2,
        title: "Hörna",
        text: "Om det lag som försvarar rör bollen sist innan den går ut bakom mållinjen får det andra laget slå en hörna från hörnflaggan. Då brukar det bli en chans att göra mål.",
      },
      {
        number: 3,
        title: "Målspark",
        text: "Om det anfallande laget rör bollen sist innan den går ut bakom mållinjen får målvakten eller en kompis slå målspark från målområdet.",
      },
    ],
  },
  {
    number: 3,
    title: "Frisparkar",
    intro: "Gör någon en smäll eller knuffar blir det frispark för det andra laget.",
    rules: [
      {
        number: 1,
        title: "När blir det frispark?",
        text: "Frispark blir det om någon knuffar, håller i, sparkar på benen i stället för bollen eller tar bollen med handen med vilje. Domaren blåser och det andra laget får slå bollen.",
      },
      {
        number: 2,
        title: "Det försvarande laget backar",
        text: "När det är frispark ska det försvarande laget backa lite så att spelaren som slår frisparken får plats. Står man för nära säger domaren till.",
      },
      {
        number: 3,
        title: "Straff",
        text: "Gör man ett fel inne i sitt eget straffområde, precis framför det egna målet, blir det straff. Då får en spelare i det andra laget skjuta mot mål med bara målvakten kvar.",
      },
    ],
  },
  {
    number: 4,
    title: "Händerna – vad gäller?",
    intro: "I fotboll använder man fötterna. Men det finns undantag.",
    rules: [
      {
        number: 1,
        title: "Målvakten får använda händerna",
        text: "Bara målvakten får ta bollen med händerna, och bara inne i sitt eget straffområde. Utanför straffområdet gäller samma regler för målvakten som för alla andra.",
      },
      {
        number: 2,
        title: "Alla andra använder fötterna",
        text: "Tar du bollen med handen blir det frispark åt det andra laget. Oftast gör domaren skillnad på om man gör det med vilje eller om bollen bara råkar träffa armen.",
      },
      {
        number: 3,
        title: "Vid inkast kastar man",
        text: "Vid inkast får alla använda händerna – det är ju så man kastar in bollen igen. Kom ihåg: över huvudet och med båda fötterna i backen.",
      },
    ],
  },
  {
    number: 5,
    title: "Offside – på ett enkelt sätt",
    intro: "Man får inte bara vänta vid motståndarnas mål och hoppas på en lång boll.",
    rules: [
      {
        number: 1,
        title: "Vänta inte framför motståndarnas mål",
        text: "En spelare får inte stå bakom alla försvarare och vänta på bollen. När en kompis passar måste det finnas minst en försvarare (förutom målvakten) mellan dig och målet – annars blåser domaren offside.",
      },
      {
        number: 2,
        title: "Spring när passningen slås",
        text: "Det smarta är att springa i samma stund som kompisen passar. Då hinner du få bollen utan att bli offside. Bra timing är konsten.",
      },
      {
        number: 3,
        title: "Fråga tränaren",
        text: "Offside är svårt även för vuxna. På er ålder är det viktigaste att man försöker spela med laget och inte står still framför mål. Tränaren förklarar gärna mer på träningen.",
      },
    ],
  },
  {
    number: 6,
    title: "Byte av spelare",
    intro: "I er ålder byter man ofta så att alla får spela.",
    rules: [
      {
        number: 1,
        title: "Alla ska få spela",
        text: "Tränaren bestämmer när det är dags att byta. När du ropas in – spring in, kämpa på och ha kul. När du ropas ut – säg bra gjort till den som byter av dig.",
      },
      {
        number: 2,
        title: "Säg till domaren",
        text: "Innan man byter ska tränaren säga till domaren. Man byter när matchen är pausad, inte mitt i spelet.",
      },
      {
        number: 3,
        title: "Heja från bänken",
        text: "Även när du inte är inne är du med i laget. Heja på dina kompisar från bänken – det hjälper mer än du tror.",
      },
    ],
  },
];

/**
 * Regelbok för lag som spelar 5 mot 5 (SvFF:s nationella spelform, 8–9 år).
 * Skillnader mot vanlig fotboll: tre perioder, sidlinjespark i stället för
 * inkast, ingen offside, ingen straffspark och inga gula eller röda kort.
 */
export const PLAYER_RULEBOOK_5V5: RuleChapter[] = [
  {
    number: 1,
    title: "Så går en match till",
    intro: "När ni spelar 5 mot 5 är matchen kortare och delad i tre delar.",
    rules: [
      {
        number: 1,
        title: "Tre perioder",
        text: "En match är uppdelad i tre perioder i stället för två halvlekar. I en vanlig match är varje period 15 minuter, och på sammandrag där ni spelar flera matcher är de 10 minuter. Mellan perioderna vilar ni och dricker vatten.",
      },
      {
        number: 2,
        title: "Fyra utespelare och en målvakt",
        text: "Ni är fem i laget på planen: fyra utespelare och en målvakt. Alla ska få spela ungefär lika mycket, så ni byter ofta.",
      },
      {
        number: 3,
        title: "Domaren bestämmer",
        text: "Domaren blåser i visselpipan och startar och stoppar spelet. Domaren hjälper er också att göra rätt och förklarar gärna reglerna.",
      },
      {
        number: 4,
        title: "Inga gula eller röda kort",
        text: "I 5 mot 5 finns inga gula eller röda kort. Om någon spelar för hårt eller är dumdristig är det tränaren som byter ut spelaren en stund.",
      },
    ],
  },
  {
    number: 2,
    title: "Bollen – in och ut",
    intro: "Bollen är ute först när HELA bollen passerat linjen. Men här finns inget inkast.",
    rules: [
      {
        number: 1,
        title: "Sidlinjespark i stället för inkast",
        text: "Går bollen ut över sidlinjen kastas den inte in. I stället sätter det andra laget igång med foten från sidlinjen – man passar eller driver i väg bollen längs marken.",
      },
      {
        number: 2,
        title: "Hörna",
        text: "Rör det försvarande laget bollen sist innan den går ut bakom mållinjen blir det hörna. Även hörnan sätts igång längs marken.",
      },
      {
        number: 3,
        title: "Igångsättning från mål",
        text: "Rör det anfallande laget bollen sist innan bollen går ut bakom mållinjen sätter målvakten igång spelet från sitt målområde.",
      },
    ],
  },
  {
    number: 3,
    title: "Fasta situationer",
    intro: "Avspark, sidlinjespark, hörna och frispark startas alltid på samma sätt.",
    rules: [
      {
        number: 1,
        title: "Rulla eller driv i gång bollen",
        text: "Alla fasta situationer startas genom att passa eller driva bollen längs marken. Du får alltså inte lyfta eller smälla i väg bollen i luften.",
      },
      {
        number: 2,
        title: "Inget mål direkt",
        text: "Man får inte göra mål direkt på en fast situation. En kompis eller du själv måste röra bollen en gång till först.",
      },
      {
        number: 3,
        title: "Fem meter avstånd",
        text: "Motståndarna ska stå minst fem meter från bollen vid en fast situation, så att den som sätter i gång spelet får plats.",
      },
    ],
  },
  {
    number: 4,
    title: "Målvakten och händerna",
    intro: "Det finns inget uppritat straffområde när ni spelar 5 mot 5.",
    rules: [
      {
        number: 1,
        title: "Målvakten tar bollen nära målet",
        text: "Målvakten får ta bollen med händerna i området närmast det egna målet, ungefär fem meter ut från stolparna. Längre ut gäller samma regler som för alla andra.",
      },
      {
        number: 2,
        title: "Ingen straffspark",
        text: "Straffspark finns inte i 5 mot 5. Blir det ett fel nära målet blir det en vanlig frispark som sätts i gång längs marken.",
      },
      {
        number: 3,
        title: "Alla andra använder fötterna",
        text: "Tar du bollen med handen blir det frispark åt det andra laget. Domaren ser skillnad på om det görs med vilje eller om bollen bara råkar träffa armen.",
      },
    ],
  },
  {
    number: 5,
    title: "Retreatlinjen – i stället för offside",
    intro: "Offside finns inte i 5 mot 5. I stället finns retreatlinjen som gör att ni får spela i gång bollen lugnt.",
    rules: [
      {
        number: 1,
        title: "Ingen offside",
        text: "Du kan inte bli avblåst för offside. Men det är ändå smartare att vara med i spelet än att bara stå och vänta vid motståndarnas mål.",
      },
      {
        number: 2,
        title: "Backa till mittlinjen",
        text: "När motståndarnas målvakt har bollen i händerna eller sätter i gång spelet ska ni backa till er egen planhalva – mittlinjen är retreatlinje. Där väntar ni tills bollen lämnat målvaktens händer.",
      },
      {
        number: 3,
        title: "Därför finns regeln",
        text: "Retreatlinjen gör att laget som har bollen vågar spela ut den och passa till varandra i stället för att bara slå långt. Det blir roligare fotboll för alla.",
      },
    ],
  },
  {
    number: 6,
    title: "Byten och att vara en bra lagkamrat",
    intro: "I 5 mot 5 är bytena fria och alla ska få spela lika mycket.",
    rules: [
      {
        number: 1,
        title: "Fria byten",
        text: "Ni får byta när som helst, men oftast byter tränaren i pausen mellan perioderna. När du ropas in – spring in och kämpa på.",
      },
      {
        number: 2,
        title: "Alla får spela lika mycket",
        text: "Tränaren ser till att alla i laget får ungefär lika lång speltid, både på träning och match.",
      },
      {
        number: 3,
        title: "Heja från sidan",
        text: "Även när du inte är inne är du med i laget. Peppa dina kompisar, och säg bra jobbat till den du byter av.",
      },
    ],
  },
];

/** Väljer rätt regelbok utifrån lagets spelform. 5 mot 5 har egna regler. */
export function rulebookForFormat(format: string | null | undefined): {
  chapters: RuleChapter[];
  formatLabel: string | null;
} {
  const text = (format ?? "").toLowerCase().replace(/\s+/g, "");
  const isFive =
    text.includes("5v5") || text.includes("5mot5") || text.includes("5-manna") || text === "five";
  return isFive
    ? { chapters: PLAYER_RULEBOOK_5V5, formatLabel: "5 mot 5" }
    : { chapters: PLAYER_RULEBOOK, formatLabel: null };
}
