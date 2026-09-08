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
