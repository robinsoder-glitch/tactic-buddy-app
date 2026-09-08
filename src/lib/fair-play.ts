/** Fair play för spelare 5–10 år. Kort språk, en sak per punkt. */
export type FairPlayRule = {
  number: number;
  title: string;
  text: string;
};

export const FAIR_PLAY_RULES: FairPlayRule[] = [
  {
    number: 1,
    title: "Säg hej till alla",
    text: "Hälsa på dina lagkamrater, på tränaren och på det andra laget innan ni börjar. Alla ska känna sig välkomna.",
  },
  {
    number: 2,
    title: "Alla får vara med",
    text: "Ingen ska stå ensam. Fråga den som är tyst eller ny om hen vill vara med i din grupp.",
  },
  {
    number: 3,
    title: "Peppa i stället för att gnälla",
    text: "Säg bra jobbat och kom igen. Skäll aldrig ut någon som missar – alla missar ibland, även proffsen.",
  },
  {
    number: 4,
    title: "Hjälp upp den som ramlar",
    text: "Räck fram handen, även om det är någon i det andra laget. Fråga om det gick bra.",
  },
  {
    number: 5,
    title: "Spela schyst",
    text: "Ta bollen, inte benen. Inga knuffar, inga tacklingar bakifrån och inget som kan göra någon illa.",
  },
  {
    number: 6,
    title: "Var ärlig",
    text: "Om bollen gick ut på dig – säg det. Om du gjorde ett fel – erkänn det. Det är modigt.",
  },
  {
    number: 7,
    title: "Lyssna på domaren och tränaren",
    text: "Domaren bestämmer, även när du tycker annorlunda. Fråga snällt efteråt om du undrar något.",
  },
  {
    number: 8,
    title: "Dela med dig av bollen",
    text: "Passa till en kompis som står fri. Det är roligare att göra mål tillsammans.",
  },
  {
    number: 9,
    title: "Fira snällt och förlora snällt",
    text: "Jubla för ditt mål, men skratta aldrig åt någon som förlorar. Säg bra match till alla efteråt.",
  },
  {
    number: 10,
    title: "Kom i tid och gör ditt bästa",
    text: "Kom till träningen, ha med dig vattenflaskan och kämpa på. Ditt bästa räcker alltid.",
  },
];
