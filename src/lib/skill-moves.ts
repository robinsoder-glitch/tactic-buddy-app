export type SkillStep = {
  title: string;
  text: string;
};

export type SkillMove = {
  rank: 1 | 2 | 3 | 4 | 5;
  id: string;
  title: string;
  nameSv: string;
  nameEn: string;
  otherNames: string;
  purpose: string;
  howTo: string[];
  practice: SkillStep[];
  phrases: string[];
  mistakes: string[];
  videos: { label: string; url: string }[];
};

function search(term: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`;
}

export const SKILL_MOVES: SkillMove[] = [
  {
    rank: 1,
    id: "kroppsfint",
    title: "Kroppsfint",
    nameSv: "Kroppsfint",
    nameEn: "Body feint eller body swerve",
    otherNames:
      "Shoulder drop, på svenska ungefär axelfint. Ibland kallas den informellt för en Messi-fint, men det är inget officiellt namn.",
    purpose:
      "Spelaren får försvararen att tro att han eller hon ska gå åt ena hållet men tar i stället med sig bollen åt det andra. Detta är den mest grundläggande finten eftersom den nästan inte kräver någon särskild bollkontakt.",
    howTo: [
      "Driv bollen rakt mot försvararen.",
      "Sakta ner något när du närmar dig.",
      "Ta ett tydligt steg åt exempelvis vänster.",
      "Böj knät och sänk vänster axel så att det ser ut som att du ska springa åt vänster.",
      "Flytta snabbt kroppsvikten åt höger.",
      "Ta med bollen åt höger, helst med utsidan av höger fot.",
      "Accelerera förbi försvararen.",
    ],
    practice: [
      {
        title: "Steg 1 – utan boll",
        text: "Två barn står mitt emot varandra. Det ena barnet lutar och kliver åt ena sidan men springer åt den andra. Kompisen försöker följa rörelsen.",
      },
      {
        title: "Steg 2 – mot en kon",
        text: "Barnet driver mot en kon, gör en stor kroppsrörelse åt ena hållet och tar bollen åt det andra.",
      },
      {
        title: "Steg 3 – mot försvarare",
        text: "Försvararen får bara gå eller röra sig långsamt. Anfallaren försöker få försvararen att flytta sin kroppsvikt innan bollen tas åt andra hållet.",
      },
    ],
    phrases: [
      "Lura med hela kroppen!",
      "Sänk axeln!",
      "Långsamt in – snabbt ut!",
      "Titta vart du låtsas springa!",
    ],
    mistakes: [
      "Barnet flyttar bara foten och glömmer kroppen.",
      "Finten görs för långt från försvararen.",
      "Barnet byter riktning men fortsätter i samma låga fart.",
    ],
    videos: [
      { label: "How To Do A Body Feint In Soccer", url: search("How To Do A Body Feint In Soccer") },
      { label: "Learn 5 Effective Body Feints – Unisport", url: search("Learn 5 Effective Body Feints Unisport") },
    ],
  },
  {
    rank: 2,
    id: "sulvandning",
    title: "Sulvändning",
    nameSv: "Sulvändning eller dra tillbaka",
    nameEn: "Drag-back turn eller pull-back",
    otherNames:
      "Drag back, pull turn och U-turn. V-drag är en vidareutveckling där bollen först dras bakåt och sedan skjuts snett framåt.",
    purpose:
      "Spelaren drar undan bollen när en motståndare kommer framifrån och vänder tillbaka till en fri yta. Rörelsen är både en grundläggande bollteknik och en enkel vändning.",
    howTo: [
      "Driv bollen framåt.",
      "Placera sulan ovanpå bollen.",
      "Dra bollen bakåt mot kroppen.",
      "Vrid samtidigt kroppen ungefär 180 grader.",
      "Ta med bollen i den nya riktningen.",
      "Titta upp och öka farten.",
    ],
    practice: [
      {
        title: "Steg 1 – stillastående",
        text: "Barnet står med sulan på bollen, drar den bakåt och vänder kroppen. Träna med båda fötterna.",
      },
      {
        title: "Steg 2 – trafikljuset",
        text: "”Grönt” betyder att barnen driver. ”Gult” betyder små och långsamma bollkontakter. ”Rött” betyder att de stannar bollen med sulan. ”Vänd” betyder sulvändning och fart åt motsatt håll.",
      },
      {
        title: "Steg 3 – rädda bollen",
        text: "En försvarare närmar sig långsamt framifrån. Anfallaren ska dra undan bollen precis innan försvararen når den.",
      },
    ],
    phrases: ["Sulan på bollen!", "Dra – vänd – spring!", "Skydda bollen med kroppen!", "Titta bakom dig efter vändningen!"],
    mistakes: [
      "Barnet sätter foten framför bollen i stället för ovanpå.",
      "Bollen dras för långt bakåt.",
      "Barnet tittar ner och springer efter vändningen utan att se vart det är på väg.",
    ],
    videos: [
      { label: "Soccer Skills for Kids – The Drag Back", url: search("Soccer Skills for Kids The Drag Back") },
      { label: "How to Do a Drag Back Turn", url: search("How to Do a Drag Back Turn soccer") },
    ],
  },
  {
    rank: 3,
    id: "insida-utsida",
    title: "Insida–utsida-finten",
    nameSv: "Insida–utsida eller insida–utsida-fint",
    nameEn: "Inside-outside move",
    otherNames: "Matthews move eller Matthews-finten, uppkallad efter den engelske spelaren Sir Stanley Matthews.",
    purpose:
      "Spelaren flyttar först bollen lite åt ena sidan och får försvararen att reagera. Därefter tar spelaren snabbt bollen åt motsatt håll med utsidan av samma fot.",
    howTo: [
      "Exemplet nedan görs med höger fot.",
      "Driv mot försvararen i kontrollerad fart.",
      "Nudda bollen lite åt vänster med insidan av höger fot.",
      "Luta samtidigt kroppen och vänster axel åt vänster.",
      "Flytta snabbt höger fot till andra sidan av bollen.",
      "Skjut bollen åt höger med utsidan av höger fot.",
      "Accelerera förbi försvararen.",
      "Insidans första kontakt ska vara liten. Om bollen flyttas för långt hinner spelaren inte använda utsidan av samma fot.",
    ],
    practice: [
      {
        title: "Steg 1 – på stället",
        text: "Gör växelvis en insideskontakt och en utsideskontakt med samma fot. Börja långsamt och träna sedan andra foten.",
      },
      {
        title: "Steg 2 – sicksack",
        text: "Placera ut flera koner. Barnet använder insida–utsida för att driva i ett sicksackmönster mellan konerna.",
      },
      {
        title: "Steg 3 – genom en port",
        text: "En kon är försvarare. Två små mål placeras på var sin sida. Barnet lurar åt det ena målet och tar bollen genom det andra.",
      },
    ],
    phrases: ["Liten touch in – stor touch ut!", "Samma fot två gånger!", "Lura med axeln!", "Explodera efter utsidan!"],
    mistakes: [
      "Den första bollkontakten blir för stor.",
      "Barnet använder olika fötter i stället för insidan och utsidan av samma fot.",
      "Kroppen visar inte den falska riktningen.",
    ],
    videos: [
      { label: "Inside Outside Tutorial – TopTekkers", url: search("Inside Outside Tutorial TopTekkers") },
      { label: "How To Do a Matthews in Soccer", url: search("How To Do a Matthews in Soccer") },
    ],
  },
  {
    rank: 4,
    id: "overstegsfint",
    title: "Överstegsfint",
    nameSv: "Överstegsfint",
    nameEn: "Step-over",
    otherNames:
      "Stepover. Den kallas ibland scissors eller saxen, men olika träningssystem skiljer mellan översteg och scissors beroende på vilket håll foten förs runt bollen. En serie snabba översteg kallas ibland Ronaldo-finten.",
    purpose:
      "Spelaren för foten runt bollen och låtsas ta med sig den åt ett håll. När försvararen reagerar tas bollen åt motsatt håll.",
    howTo: [
      "Driv rakt mot försvararen.",
      "För exempelvis höger fot från bollens vänstra sida, runt framför bollen och ut på dess högra sida.",
      "Luta överkroppen åt höger som om du tänker springa där.",
      "Låt bollen ligga kvar under själva översteget.",
      "Ta bollen åt vänster med utsidan av vänster fot.",
      "Accelerera förbi försvararen.",
      "Barnen behöver bara lära sig ett översteg. Dubbla och tredubbla översteg kan komma senare.",
    ],
    practice: [
      {
        title: "Steg 1 – stillastående",
        text: "Bollen ligger stilla. Barnet tränar på att långsamt föra foten runt bollen utan att nudda den.",
      },
      {
        title: "Steg 2 – översteg och port",
        text: "Barnet driver mot en kon, gör ett översteg och tar bollen genom en port på motsatt sida.",
      },
      {
        title: "Steg 3 – 1 mot 1",
        text: "Gör en smal spelplan med ett mål bakom försvararen. Anfallaren får gärna använda översteget men måste inte göra det varje gång.",
      },
    ],
    phrases: [
      "Runt bollen – inte på bollen!",
      "Visa tydligt åt ena hållet!",
      "Ta bollen åt andra hållet!",
      "Långsamt före – snabbt efter!",
    ],
    mistakes: [
      "Barnet trampar på eller sparkar till bollen under översteget.",
      "Foten går över bollens ovansida i stället för runt bollens framsida.",
      "Rörelsen görs mycket snabbt men utan att kroppen lutar och lurar försvararen.",
    ],
    videos: [
      { label: "How To Do A Step Over – Soccer 101 by MOJO", url: search("How To Do A Step Over Soccer 101 MOJO") },
      { label: "Three Simple Stepover Drills", url: search("Three Simple Stepover Drills soccer") },
    ],
  },
  {
    rank: 5,
    id: "cruyffvandning",
    title: "Cruyffvändning",
    nameSv: "Cruyffvändning eller Cruyfffint",
    nameEn: "Cruyff turn",
    otherNames:
      "Cruyff cut eller Cruijff turn. Rörelsen är uppkallad efter Johan Cruyff och kombinerar en pass- eller skottfint med en vändning.",
    purpose:
      "Spelaren låtsas passa, skjuta eller slå ett inlägg. I stället dras bollen bakom stödjebenet och spelaren vänder bort från försvararen.",
    howTo: [
      "Exemplet görs med höger fot.",
      "Placera vänster fot bredvid och lite framför bollen.",
      "För höger ben bakåt som om du tänker skjuta eller passa.",
      "Titta gärna upp mot det tänkta målet eller medspelaren.",
      "Avbryt sparkrörelsen.",
      "Använd insidan av höger fot för att föra bollen bakom vänster ben.",
      "Vrid axlarna och hela kroppen åt vänster.",
      "Följ med bollen och accelerera i den nya riktningen.",
    ],
    practice: [
      {
        title: "Steg 1 – passfint utan motståndare",
        text: "Barnet driver mot en linje och låtsas passa över linjen. I stället gör barnet Cruyffvändningen och driver tillbaka.",
      },
      {
        title: "Steg 2 – mot en kon",
        text: "Konen föreställer en försvarare. Barnet visar en tydlig skott- eller passrörelse innan bollen tas bakom stödjebenet.",
      },
      {
        title: "Steg 3 – vid sidlinjen",
        text: "Barnet driver mot en linje som om det ska slå ett inlägg, gör Cruyffvändningen och driver tillbaka in på planen.",
      },
      {
        title: "Steg 4 – passiv försvarare",
        text: "Försvararen följer anfallaren från sidan eller bakifrån. Anfallaren använder kroppen som skydd när bollen tas bakom stödjebenet.",
      },
    ],
    phrases: ["Visa ett riktigt skott!", "Bollen bakom stödjebenet!", "Vänd axlarna!", "Skydda och spring!"],
    mistakes: [
      "Pass- eller skottfinten är för liten för att lura försvararen.",
      "Barnet sparkar bollen bakåt i stället för att föra den kontrollerat bakom stödjebenet.",
      "Stödjefoten placeras för långt från bollen.",
    ],
    videos: [
      { label: "Cruyff Turn – särskilt framtagen för barn 5–9 år", url: search("Cruyff Turn for kids soccer") },
      { label: "How to Do a Cruyff Turn – Soccer Skills by MOJO", url: search("How to Do a Cruyff Turn Soccer Skills MOJO") },
    ],
  },
];

export const SKILL_PROGRESSION: string[] = [
  "Lär känna rörelsen: Gör den långsamt utan motståndare.",
  "Kontrollera bollen: Gör rörelsen mot en stillastående kon.",
  "Lägg till fart: Driv mot konen och accelerera efter finten.",
  "Lägg till ett val: Placera två mål eller portar på olika sidor.",
  "Lägg till en försvarare: Börja med en passiv försvarare.",
  "Spela 1 mot 1: Låt barnet själv välja om och när finten ska användas.",
  "Använd den i smålagsspel: Uppmuntra försöken men kräv inte att finten lyckas.",
];

export const SKILL_AGE_NOTES: string[] = [
  "Alla barn bör ha var sin boll under teknikträningen.",
  "Undvik långa köer.",
  "Träna hellre en fint under några minuter än alla fem samtidigt.",
  "Låt barnen träna med både höger och vänster fot.",
  "Börja långsamt. Farten kommer när rörelsen känns trygg.",
  "Beröm försök och mod, inte bara lyckade finter.",
  "Finten är inte färdig förrän spelaren accelererar eller hittar en passning efteråt.",
];

export function skillMovesByRank(): SkillMove[] {
  return [...SKILL_MOVES].sort((a, b) => a.rank - b.rank);
}
