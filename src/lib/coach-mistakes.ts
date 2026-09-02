export type CoachMistake = {
  rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  title: string;
  whatItIs: string;
  whyItMatters: string;
  doInstead: string;
  coachPhrase: string;
  sourceKeys: string[];
};

export type MistakeSource = {
  key: string;
  label: string;
  url: string;
};

export const COACH_MISTAKES: CoachMistake[] = [
  {
    rank: 1,
    title: "Otryggt bemötande eller bristande säkerhet",
    whatItIs:
      "Tränaren skriker, skäller, använder ironi, skambelägger misstag eller låter barn reta och utesluta varandra. Felet omfattar också fysiskt osäkra övningar, exempelvis för små ytor, farligt placerade mål eller att tränaren inte ingriper när ett barn skadas eller visar att något inte känns bra.",
    whyItMatters:
      "Trygghet är grunden för allt annat. Ett barn som är rädd för tränaren, andra spelare eller att göra fel vågar inte prova, fråga eller vara kreativt. Kränkningar och fysisk säkerhetsbrist kan dessutom skada barnet direkt. Därför ligger detta fel på plats 1 även om det inte nödvändigtvis är det statistiskt vanligaste.",
    doInstead:
      "Ha få och tydliga regler: vi hjälper varandra, vi skrattar inte åt misstag och vi stannar när någon skadar sig. Kontrollera yta, mål och material före start. Bemöt fel lugnt, agera direkt vid kränkningar och tala enskilt med barnet när något behöver rättas.",
    coachPhrase: "Här får vi prova och misslyckas. Vi hjälper varandra att försöka igen.",
    sourceKeys: ["svff", "rf", "fifa-principles-1"],
  },
  {
    rank: 2,
    title: "Resultatet går före barnen",
    whatItIs:
      "Tränaren toppar laget, ger de skickligaste barnen mest speltid, låter vissa barn alltid börja på bänken eller låser ”de bästa” i centrala roller för att vinna. Matchresultatet får styra vilka barn som får utvecklas.",
    whyItMatters:
      "Barn 5–8 år behöver få spela för att lära sig och känna att de hör till laget. Ojämn speltid kan göra barn ointresserade och lämna de sent utvecklade efter. Kortsiktiga resultat får inte ge långsiktiga konsekvenser för ett barns möjlighet att delta och utvecklas.",
    doInstead:
      "Planera jämn speltid i förväg. Rotera startspelare, positioner och ansvar. Utvärdera matchen utifrån mod, försök, samarbete och nya färdigheter – inte bara mål och seger.",
    coachPhrase: "I dag tittar vi på hur modigt vi försöker och hur bra vi hjälper varandra.",
    sourceKeys: ["svff", "rf", "england-equal-time"],
  },
  {
    rank: 3,
    title: "För lite glädje och motivation",
    whatItIs:
      "Träningen känns som en uppgift barnen måste klara åt tränaren. Övningarna är monotona, för lätta eller för svåra. Tränaren använder press, hot om löpning eller ständig tävling i stället för nyfikenhet, lek och lagom utmaning.",
    whyItMatters:
      "För barn i denna ålder är glädje inte en belöning efter lärandet – den är en förutsättning för engagemang och fortsatt deltagande. En positiv motivationsmiljö gör barn mer benägna att försöka, vara kreativa och våga misslyckas.",
    doInstead:
      "Ge övningen ett enkelt lekfullt uppdrag, erbjud två val och anpassa svårighetsgraden så att barnet både kan lyckas och utmanas. Använd korta tävlingar där ingen slås ut och låt barnen ibland påverka regel eller avslutningsspel.",
    coachPhrase: "Vill ni spela med fyra små mål eller två stora mål? Ni får välja.",
    sourceKeys: ["fifa-principles-2", "motivational-climate", "fifa-warmups"],
  },
  {
    rank: 4,
    title: "Tränaren pratar och styr för mycket",
    whatItIs:
      "Tränaren håller långa genomgångar, avbryter spelet ofta och talar om exakt var varje barn ska stå och passa. Barnen får så många instruktioner att de slutar titta, tänka och fatta egna beslut.",
    whyItMatters:
      "Observationsstudier i ungdomsfotboll visar att tränare ofta instruerar mer och frågar mindre än de själva tror. För 5–8-åringar blir långa muntliga förklaringar särskilt svåra att omsätta. För mycket styrning minskar aktivitet, självständighet och kreativitet.",
    doInstead:
      "Visa kort, starta snabbt och låt barnen prova. Observera innan du ingriper. Stoppa bara när det finns ett tydligt lärandevärde och ställ helst en enkel fråga i stället för att ge hela lösningen.",
    coachPhrase: "Vad såg du precis innan du fick bollen?",
    sourceKeys: ["ford-yates-williams", "fifa-coaching-behaviour"],
  },
  {
    rank: 5,
    title: "För mycket kö och väntan",
    whatItIs:
      "En spelare gör övningen medan många står i kö. Det finns för få bollar, för stora lag eller långa pauser när tränaren bygger om planen och förklarar nästa moment.",
    whyItMatters:
      "Barn lär sig genom att röra sig, prova och få många bollkontakter. Väntan ger mindre lärande och gör att uppmärksamheten försvinner. Det leder dessutom ofta till oro och konflikter i gruppen.",
    doInstead:
      "Bygg ytorna före träningen, använd flera små planer och dela gruppen. Ge om möjligt varje barn en boll i teknikmoment. Om en övning skapar en kö: starta en parallell station eller ändra organisationen direkt.",
    coachPhrase: "Alla ska vara med samtidigt – hitta en ledig yta och börja.",
    sourceKeys: ["fifa-principles-2", "fifa-play-practice-play"],
  },
  {
    rank: 6,
    title: "För lite spel och egna beslut",
    whatItIs:
      "Stora delar av passet består av konbanor, passningar utan motstånd eller teknik som saknar mål, riktning och val. Tränaren löser varje situation åt spelarna i stället för att låta spelet skapa problem att lösa.",
    whyItMatters:
      "Barn behöver koppla teknik till att se, välja och agera. Spelbaserade aktiviteter ger motstånd, riktning, samarbete och riktiga beslut. Forskning har också observerat att ungdomstränare ofta lägger mer tid på träningsformer som är mindre matchlika än på smålagsspel.",
    doInstead:
      "Börja och avsluta med spel. Gör teknikdelen kort och koppla den direkt till ett enkelt problem i spelet. Använd smålagsspel där varje barn ofta kommer nära bollen.",
    coachPhrase: "Kan du hitta en ny väg till mål när den första vägen är stängd?",
    sourceKeys: ["ford-yates-williams", "fifa-play-practice-play"],
  },
  {
    rank: 7,
    title: "Barnen tränas som små vuxna",
    whatItIs:
      "Träningen fylls med fasta positioner, komplicerade spelsystem, vuxna taktikord, löpning utan boll eller tidig specialisering. Tränaren försöker skapa ett färdigt lag i stället för barn som tycker om att spela och utforska fotboll.",
    whyItMatters:
      "Barn 5–8 år behöver lek, variation och allsidig rörelse. Tidig låsning vid en position eller en enda typ av träning minskar antalet erfarenheter och kan göra barnet rädd för att lämna sin plats. Det som ser organiserat ut för vuxna är inte alltid det som utvecklar barn bäst.",
    doInstead:
      "Rotera positioner och målvaktsroll. Träna springa, hoppa, vända, balansera, driva, passa och skjuta genom lek och smålagsspel. Använd ett enkelt tema åt gången och språk som barnen förstår.",
    coachPhrase: "Prova en ny plats i dag. Vad upptäcker du där?",
    sourceKeys: ["svff", "rf", "fifa-play-practice-play"],
  },
  {
    rank: 8,
    title: "Samma krav och övning för alla",
    whatItIs:
      "Alla får exakt samma yta, tid, regel och svårighetsgrad trots stora skillnader i erfarenhet, mognad, koncentration, fysisk förmåga eller behov av stöd. De starkaste tar över medan andra knappt lyckas delta.",
    whyItMatters:
      "Likvärdighet betyder inte att alla alltid ska få identiska uppgifter. Barn utvecklas i olika takt. Om uppgiften aldrig anpassas blir vissa uttråkade och andra uppgivna eller utpekade.",
    doInstead:
      "Förbered en enklare och en svårare variant av samma lek. Anpassa yta, antal motståndare, avstånd, boll eller tid utan att värdera barnen. Se till att alla får en verklig roll och möjlighet att lyckas.",
    coachPhrase: "Välj den port som utmanar dig lagom mycket. Du kan byta när du vill.",
    sourceKeys: ["rf", "fifa-principles-2"],
  },
  {
    rank: 9,
    title: "Feedbacken handlar mest om fel",
    whatItIs:
      "Tränaren kommenterar främst missade passningar och fel beslut, jämför barn med varandra eller säger bara ett allmänt ”bra” utan att barnet förstår vad som var bra. Flera saker korrigeras samtidigt.",
    whyItMatters:
      "Barn behöver konkret och konstruktiv uppmuntran. Om uppmärksamheten nästan bara kommer när något blir fel kan barnet börja spela försiktigt och undvika svåra försök. Samtidigt hjälper ospecifikt beröm inte barnet att förstå sitt framsteg.",
    doInstead:
      "Beskriv ett observerbart beteende: blicken före mottagningen, försöket att använda båda fötterna eller hjälpen till en lagkamrat. Ge högst ett tydligt fokus åt gången och låt barnet själv reflektera.",
    coachPhrase: "Bra att du tittade upp före passningen. Vad hjälpte det dig att se?",
    sourceKeys: ["fifa-coaching-behaviour", "motivational-climate"],
  },
  {
    rank: 10,
    title: "Otydliga ramar för föräldrar och ledare",
    whatItIs:
      "Föräldrar och flera ledare ger olika instruktioner från sidan, ropar om resultat eller ifrågasätter speltid. Tränaren har inte i förväg förklarat lagets syn på glädje, jämn speltid, beteende och vem som coachar under match.",
    whyItMatters:
      "Barnet kan bli stressat och osäkert när vuxna drar åt olika håll. Ett resultatinriktat sidlinjebeteende kan motverka det trygga och utvecklande klimat som tränaren försöker skapa.",
    doInstead:
      "Kom överens före säsongen: föräldrar uppmuntrar, tränarna coachar och alla respekterar domare och motståndare. Förklara principen om jämn speltid. Bestäm en lugn kanal för frågor efter matchen och fördela praktiska roller mellan vuxna.",
    coachPhrase:
      "Från sidlinjen uppmuntrar vi. Instruktionerna kommer från tränarna så att barnen får ett tydligt budskap.",
    sourceKeys: ["svff", "rf", "england-equal-time"],
  },
];

export const MISTAKE_SOURCES: MistakeSource[] = [
  {
    key: "svff",
    label: "Svenska Fotbollförbundet – Fotbollens spela, lek och lär",
    url: "https://aktiva.svenskfotboll.se/forening/tryggfotboll/fotbollens-spela-lek-och-lar/",
  },
  {
    key: "rf",
    label: "Riksidrottsförbundet – Riktlinjer för barn- och ungdomsidrott",
    url: "https://www.rf.se/rf-arbetar-med/barn--och-ungdomsidrott/riktlinjer-for-barn--och-ungdomsidrott",
  },
  {
    key: "fifa-principles-1",
    label: "FIFA Training Centre – Fun, safe and effective playing environment",
    url: "https://www.fifatrainingcentre.com/en/practice/grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/jene-general-principles-1.php",
  },
  {
    key: "fifa-principles-2",
    label: "FIFA Training Centre – Inclusive, game-based and actively engaging sessions",
    url: "https://www.fifatrainingcentre.com/en/practice/grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/jene-general-principles-2.php",
  },
  {
    key: "fifa-play-practice-play",
    label: "FIFA Training Centre – Ages 4–8: Play–Practice–Play",
    url: "https://www.fifatrainingcentre.com/en/practice/grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/an-introduction-to-play-practice-play.php",
  },
  {
    key: "fifa-warmups",
    label: "FIFA Training Centre – Ages 4–8: Fun and effective warm-ups",
    url: "https://www.fifatrainingcentre.com/en/practice/grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/creating-fun-and-effective-warm-ups.php",
  },
  {
    key: "england-equal-time",
    label: "England Football Learning – Equal playing time",
    url: "https://learn.englandfootball.com/articles-and-resources/coaching/resources/2023/What-is-equal-playing-time-in-football",
  },
  {
    key: "ford-yates-williams",
    label: "Ford, Yates & Williams – observations of youth football coaching",
    url: "https://doi.org/10.1080/02640410903582750",
  },
  {
    key: "fifa-coaching-behaviour",
    label: "FIFA Training Centre – research summary on coaching behaviour",
    url: "https://www.fifatrainingcentre.com/en/environment/science-explained/high-performance/train/chris-cushion-and-stephen-harvey-on-coaching-behaviour.php",
  },
  {
    key: "motivational-climate",
    label: "Gu & Cheng – systematic review and meta-analysis of motivational climate",
    url: "https://doi.org/10.3389/fpsyg.2025.1716745",
  },
];

export function mistakesByRank(): CoachMistake[] {
  return [...COACH_MISTAKES].sort((a, b) => a.rank - b.rank);
}
