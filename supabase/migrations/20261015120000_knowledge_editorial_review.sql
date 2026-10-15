-- Redaktionell granskning 2026-10-15. Ingen ändring av behörigheter eller tabellstruktur.
-- Varje rättning skyddas mot att skriva över en senare ändring av de berörda fälten.
-- Artikel-ID, slug och befintliga innehållslänkar bevaras.
BEGIN;

-- KB005: Undvik en fast 55-minutersmall för hela åldersspannet 4–8 år.
UPDATE public.knowledge_articles
SET try_next_sv = 'Börja med ett kort spel, välj ett träningsmoment utifrån det du ser och avsluta med spel igen. Anpassa blockens längd efter barnens ork och engagemang.',
    updated_at = now()
WHERE id = 'KB005'
  AND original_url = 'https://www.fifatrainingcentre.com/en/practice/grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/an-introduction-to-play-practice-play.php'
  AND try_next_sv IS NOT DISTINCT FROM 'Prova 15 minuter spel, 20 minuter tematräning och 20 minuter spel med samma tema.';

-- KB007: Ersätt ett omotiverat generellt filmförbud med ett konkret pedagogiskt råd.
UPDATE public.knowledge_articles
SET try_next_sv = 'Visa momentet kort, låt spelarna prova och återgå sedan till spel där färdigheten behövs. Anpassa instruktionen efter vad barnen faktiskt behöver hjälp med.',
    updated_at = now()
WHERE id = 'KB007'
  AND original_url = 'https://www.fifatrainingcentre.com/en/practice/grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/coaching-with-the-global-analytical-global-model.php'
  AND try_next_sv IS NOT DISTINCT FROM 'Filma inte och föreläs inte: visa momentet på 30 sekunder och låt spelarna snabbt prova igen i spel.';

-- KB011: Språkrättning.
UPDATE public.knowledge_articles
SET try_next_sv = 'Ge varje barn en boll och låt dem lösa tre kontrolluppgifter i egen takt.',
    updated_at = now()
WHERE id = 'KB011'
  AND original_url = 'https://www.fifatrainingcentre.com/en/practice/grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/coaching-children-to-master-ball-control.php'
  AND try_next_sv IS NOT DISTINCT FROM 'Skapa en boll per barn och låt dem lösa tre kontrolluppgifter i egen takt.';

-- KB035: Forskningsstöd för ett program får inte antydas gälla ett godtyckligt urval av tre övningar.
UPDATE public.knowledge_articles
SET try_next_sv = 'Välj ett program som passar barnens ålder och följ programmets instruktioner om innehåll, progression och regelbundenhet.',
    updated_at = now()
WHERE id = 'KB035'
  AND original_url = 'https://aktiva.svenskfotboll.se/spelare/halsa/skadeforebyggande-program/'
  AND try_next_sv IS NOT DISTINCT FROM 'Välj tre övningar ur FIFA 11+ Kids och använd dem i uppvärmningen två gånger i veckan.';

-- KB048: Översikten är ingen metaanalys. Flytta till ämnet skadeprevention och beskriv studiernas målgrupp och begränsningar.
UPDATE public.knowledge_articles
SET category = 'Skador och skadeprevention',
    content_type = 'Systematisk forskningsöversikt',
    summary_sv = 'Översikten från 2024 omfattar elva studier med över 10 000 deltagare, främst 7–14 år. Fyra studier undersökte skador och rapporterade färre skador vid användning av FIFA 11+ Kids. Övriga studier gällde bland annat fysisk förmåga och uppmärksamhet. Studiernas kvalitet och upplägg varierade. Resultaten beskriver programmet som helhet och ger inget säkert effektmått för en enskild övning eller ett visst barnlag.',
    evidence_level = 'Systematisk översikt med varierande studiekvalitet; ingen sammanvägd metaanalys. Främst deltagare 7–14 år.',
    checked_date = '2026-10-15',
    updated_at = now()
WHERE id = 'KB048'
  AND original_url = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11264619/'
  AND category IS NOT DISTINCT FROM 'Fördjupning och forskning'
  AND content_type IS NOT DISTINCT FROM 'Systematisk översikt och metaanalys'
  AND summary_sv IS NOT DISTINCT FROM 'En systematisk översikt och metaanalys från 2024 om effekten av FIFA 11+ Kids på skaderisk hos barn som spelar fotboll.'
  AND evidence_level IS NOT DISTINCT FROM 'Peer review – systematisk översikt'
  AND checked_date IS NOT DISTINCT FROM '2026-08-30';

-- KB049: Forskningsreferat ska hittas under sitt ämne och skiljas från originalstudier.
UPDATE public.knowledge_articles
SET category = 'Ledarskap och pedagogik',
    updated_at = now()
WHERE id = 'KB049'
  AND original_url = 'https://aktiva.svenskfotboll.se/nyheter/2023/07/forskningsstudie-del-1-studie-om-motivation-och-ledarskap/'
  AND category IS NOT DISTINCT FROM 'Fördjupning och forskning';

-- KB050: Placera originalstudien under fysisk utveckling, där den hör hemma.
UPDATE public.knowledge_articles
SET category = 'Fysik och motorik',
    updated_at = now()
WHERE id = 'KB050'
  AND original_url = 'https://bjsm.bmj.com/content/52/4/254'
  AND category IS NOT DISTINCT FROM 'Fördjupning och forskning';

-- KB052: Sidan är en översikt över tränarutbildning.
UPDATE public.knowledge_articles
SET content_type = 'Utbildningsöversikt',
    updated_at = now()
WHERE id = 'KB052'
  AND original_url = 'https://canadasoccer.com/coach/grassroots-coach-education/'
  AND content_type IS NOT DISTINCT FROM 'Artikel och guide';

-- KB053: Direktlänk till Active Start-manualen hittad från Canada Soccers resurssida.
UPDATE public.knowledge_articles
SET original_url = 'https://canadasoccer.com/wp-content/uploads/2026/02/CanadaSoccerPathway_CoachsToolKit_ActiveStart_EN.pdf',
    updated_at = now()
WHERE id = 'KB053'
  AND original_url = 'https://canadasoccer.com/play/canada-soccer-ecosystem/';

-- KB054: Ett resursarkiv är inte forskning; behåll typ och sortera efter ämne.
UPDATE public.knowledge_articles
SET category = 'Träningsplanering',
    updated_at = now()
WHERE id = 'KB054'
  AND original_url = 'https://canadasoccer.com/?resource_collection=canada-soccer-pathway-resources'
  AND category IS NOT DISTINCT FROM 'Fördjupning och forskning';

-- KB064: Direktlänk till rätt häfte i DFB:s nedladdningsarkiv.
UPDATE public.knowledge_articles
SET original_url = 'https://assets.dfb.de/uploads/000/282/720/original_DFB_TRAININGSDIALOG_2.pdf?1682579033=',
    updated_at = now()
WHERE id = 'KB064'
  AND original_url = 'https://www.dfb-akademie.de/downloads/-/id-11011289';

-- KB066: Sidan samlar andra resurser och ska kunna filtreras som resursbank.
UPDATE public.knowledge_articles
SET content_type = 'Resursbank',
    updated_at = now()
WHERE id = 'KB066'
  AND original_url = 'https://footballaustralia.com.au/coaching-resources'
  AND content_type IS NOT DISTINCT FROM 'Artikel och guide';

-- KB072: Avgränsa råd för talangspelare med flera träningsmiljöer från generell barnfotboll.
UPDATE public.knowledge_articles
SET category = 'Skador och skadeprevention',
    title_sv = 'Träningsbelastning i talangmiljöer – läs med åldersperspektiv',
    summary_sv = 'Football Australias riktlinjer är framtagna mot bakgrund av talangspelare under 17 år som tränar i flera miljöer. De tar upp samordning, återhämtning, vilodagar och anpassning vid tillväxt och annan belastning. De exakta doserna är rekommendationer i den miljön och ska inte användas som ett generellt veckoschema för svenska lag med 5–10-åringar.',
    evidence_level = 'Förbundsriktlinjer för strukturerad ungdoms- och talangträning. Ingen effektstudie på svenska barnlag 5–10 år.',
    coach_value = 'Bakgrund för samtal om total belastning',
    checked_date = '2026-10-15',
    updated_at = now()
WHERE id = 'KB072'
  AND original_url = 'https://footballaustralia.com.au/youth-training-guidelines'
  AND category IS NOT DISTINCT FROM 'Kost, vätska och återhämtning'
  AND title_sv IS NOT DISTINCT FROM 'Riktlinjer för träningsmängd och återhämtning'
  AND summary_sv IS NOT DISTINCT FROM 'Råd om vilodagar, återhämtning mellan fotbollspass, allsidig rörelse och perioder utan organiserad fotboll.'
  AND evidence_level IS NOT DISTINCT FROM 'Officiella medicinska riktlinjer'
  AND coach_value IS NOT DISTINCT FROM 'Direkt användbar'
  AND checked_date IS NOT DISTINCT FROM '2026-08-30';

-- KB074: Skilj inspiration till träningsspel från regler för svensk match.
UPDATE public.knowledge_articles
SET try_next_sv = 'Jämför hur Wales anpassar plan och spelarantal. Pröva en idé i ett träningsspel; följ SvFF:s regler och distriktets tävlingsbestämmelser på svenska matcher.',
    updated_at = now()
WHERE id = 'KB074'
  AND original_url = 'https://faw.cymru/small-sided-football/'
  AND try_next_sv IS NOT DISTINCT FROM 'Jämför er spelform med U8/U9- eller U10/U11-exemplet och välj en regel som ökar delaktigheten.';

-- KB103: Undvik ordet bäst; kartläggande översikt fastställer ingen universellt bästa metod.
UPDATE public.knowledge_articles
SET category = 'Spelförståelse och taktik',
    title_sv = 'Vad forskningen säger om att utveckla beslutsfattande i fotboll',
    evidence_level = 'Kartläggande översikt av 36 studier med unga och vuxna spelare. Främst manliga deltagare; varierande metoder och begränsad rapportering av effektstorlekar. Ingen säker rangordning av träningsmetoder för 5–10-åringar.',
    checked_date = '2026-10-15',
    updated_at = now()
WHERE id = 'KB103'
  AND original_url = 'https://pubmed.ncbi.nlm.nih.gov/41842699/'
  AND category IS NOT DISTINCT FROM 'Fördjupning och forskning'
  AND title_sv IS NOT DISTINCT FROM 'Hur beslutsfattande bäst utvecklas i fotboll'
  AND evidence_level IS NOT DISTINCT FROM 'Kartläggande översikt av 36 studier'
  AND checked_date IS NOT DISTINCT FROM '2026-09-08';

-- KB104: Förtydliga målgruppen 8–18 år och att fotledsresultatet med exponeringsdata kommer från en studie.
UPDATE public.knowledge_articles
SET summary_sv = 'Översikten omfattar fem randomiserade studier med 6 447 fotbollsspelare och avser åldrarna 8–18 år. Den sammanvägda analysen gav statistiskt osäkra resultat för alla skador i nedre extremiteterna och för knäskador. En studie med uppgifter om exponeringstid visade färre fotledsskador, men underlaget räckte inte för en metaanalys av fotledsskador. Resultaten kan inte direkt generaliseras till de yngsta barnlagen.',
    learn_sv = 'Hur studiedeltagarnas ålder och skillnaden mellan en enskild studie och sammanvägda resultat påverkar vad tränaren kan dra för slutsatser.',
    evidence_level = 'Fem randomiserade studier; 6 447 deltagare, målgrupp 8–18 år. Sammanvägda resultat för alla skador i nedre extremiteterna och knäskador är osäkra. Fotledsresultat med exponeringstid från en studie.',
    checked_date = '2026-10-15',
    updated_at = now()
WHERE id = 'KB104'
  AND original_url = 'https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2026.1853354/full'
  AND summary_sv IS NOT DISTINCT FROM 'En systematisk översikt och metaanalys av fem randomiserade studier med sammanlagt 6 447 spelare. Balans-, styrke-, hopp-, riktningsförändrings- och rörelsekontrollövningar visade ett lovande skydd mot framför allt fotledsskador. Resultaten för samtliga underbens- och knäskador var däremot statistiskt osäkra.'
  AND learn_sv IS NOT DISTINCT FROM 'Vilka delar av neuromuskulär träning som har starkast stöd och var slutsatserna fortfarande är osäkra.'
  AND evidence_level IS NOT DISTINCT FROM 'Fem randomiserade studier; 6 447 deltagare'
  AND checked_date IS NOT DISTINCT FROM '2026-09-08';

-- KB105: Rubrik och sammanfattning ska visa att den föreslagna mekanismen är en teori.
UPDATE public.knowledge_articles
SET title_sv = 'En teori om varför spelbaserat lärande kan fungera',
    summary_sv = 'En konceptuell analys kopplar Teaching Games for Understanding till en möjlig förklaring genom samtidig fysisk och kognitiv belastning. Författaren diskuterar tidigare forskning och föreslår en modell att pröva vidare. Artikeln innehåller ingen ny träningsintervention och visar inte att den föreslagna mekanismen fungerar hos fotbollsbarn i åldern 5–10 år.',
    checked_date = '2026-10-15',
    updated_at = now()
WHERE id = 'KB105'
  AND original_url = 'https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2026.1889606/full'
  AND title_sv IS NOT DISTINCT FROM 'Spelbaserad träning kan stärka lärande och beslutsfattande'
  AND summary_sv IS NOT DISTINCT FROM 'Artikeln analyserar Teaching Games for Understanding, där tekniska färdigheter utvecklas i förenklade spel med riktiga val och problem. Tidigare forskning visar förbättringar i beslutsfattande, taktisk förståelse, motivation och spelutförande. Författaren föreslår att samtidig fysisk och kognitiv belastning kan vara en del av förklaringen.'
  AND checked_date IS NOT DISTINCT FROM '2026-09-08';

-- KB107: Redovisa 10–11 veckor, olika scheman och avsaknad av egentlig kontrollgrupp; skilj riktningsförändring från ren snabbhet.
UPDATE public.knowledge_articles
SET summary_sv = 'En amerikansk pilotstudie följde 40 barn i två fritidsverksamheter under 10–11 veckor. Fotboll kombinerades med hälsoteman. Upplägget anpassades till verksamheterna och genomfördes som två 45-minuterspass eller ett 90-minuterspass per vecka. Vissa fysiska testresultat förbättrades, men hälsokunskapen ökade inte tydligt. Närvaron var i genomsnitt 69 procent och någon egentlig kontrollgrupp saknades, vilket begränsar slutsatser om orsak och effekt.',
    checked_date = '2026-10-15',
    updated_at = now()
WHERE id = 'KB107'
  AND original_url = 'https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2026.1765167/full'
  AND summary_sv IS NOT DISTINCT FROM 'Fyrtio barn deltog i ett elva veckor långt program med två 45-minuterspass per vecka. Fotbollsövningar och smålagsspel kombinerades med teman som respekt, vatten, balanserad kost, positivt tänkande och fysisk aktivitet. Kondition och snabbhet förbättrades, men hälsokunskapen ökade inte tydligt. Närvaron var 69 procent, vilket begränsar slutsatserna.'
  AND checked_date IS NOT DISTINCT FROM '2026-09-08';

-- KB043: Sammanfatta endast den verifierbara presentationssidan; podden har inte avlyssnats och längden är inte verifierad.
UPDATE public.knowledge_articles
SET summary_sv = 'SvFF presenterar ett poddavsnitt där den nationella fotbollsutbildaren Marie Svensson ger fem tips till föräldratränare och ledare i barn- och ungdomsfotbollen. Presentationssidan beskriver avsnittets syfte: att hjälpa ledare att lyckas och ha roligt i sitt uppdrag. För själva råden behöver du lyssna på avsnittet.',
    learn_sv = 'Var du hittar ett svenskt poddavsnitt riktat till föräldrar som leder barn- och ungdomslag.',
    evidence_level = 'SvFF:s presentation av ett poddavsnitt. Sammanfattningen bygger på presentationssidan.',
    reading_minutes = NULL,
    checked_date = '2026-10-15',
    updated_at = now()
WHERE id = 'KB043'
  AND original_url = 'https://aktiva.svenskfotboll.se/nyheter/2025/04/podd-foraldratranare/'
  AND summary_sv IS NOT DISTINCT FROM 'Poddavsnitt från Svenska Fotbollförbundet där nationella fotbollsutbildaren Marie Svensson ger fem konkreta råd till de tusentals föräldrar som leder barn- och ungdomslag. Avsnittet handlar om hur du hittar din roll som ledare, gör planeringen enkel, ser alla barn i gruppen, håller en rak dialog med övriga föräldrar och behåller din egen glädje i uppdraget.'
  AND learn_sv IS NOT DISTINCT FROM 'Hur du som förälder utan tränarbakgrund kan göra ledarrollen hållbar, rolig och tydlig – för barnen, för föräldragruppen och för dig själv.'
  AND evidence_level IS NOT DISTINCT FROM 'Officiellt utbildningsmaterial'
  AND reading_minutes IS NOT DISTINCT FROM 25
  AND checked_date IS NOT DISTINCT FROM '2026-09-04';

INSERT INTO public.knowledge_articles (id, slug, title_sv, title_original, summary_sv, learn_sv, try_next_sv, category, age_label, age_5_7, age_8_9, age_10, game_format_label, format_3v3, format_5v5, format_7v7, level, content_type, language, source_name, source_type, reading_minutes, coach_value, evidence_level, original_url, checked_date, is_published, featured, sort_order, copyright_note)
SELECT 'KB113', 'sank-trosklarna-for-deltagande', 'Sänk trösklarna så att fler barn kan vara med', NULL, 'Riksidrottsförbundet betonar att social bakgrund och ekonomiska förutsättningar inte ska hindra deltagande. Trygghet och inkludering kräver att föreningen undersöker hinder, planerar åtgärder tillsammans med berörda och följer upp vad som förändras.', 'Hur inkludering kan bli ett återkommande arbete i tränargruppen, med uppmärksamhet på vilka barn som saknar möjlighet att delta.', 'Kartlägg tillsammans med föreningen vilka kostnader och praktiska hinder laget skapar. Pröva exempelvis låneutrustning, samordnad transport eller tydligare information och fråga berörda familjer om det hjälper.', 'Trygghet och inkludering', '5–10 år', true, true, true, '3 mot 3; 5 mot 5; 7 mot 7', true, true, true, 'Grund', 'Riktlinje och guide', 'Svenska', 'Riksidrottsförbundet', 'Svenskt kunskapsstöd', NULL, 'Stöd för tränargruppen', 'Svensk värdegrund och vägledning. Förslagen för laget är redaktionella tillämpningar, inte prövade effektmått.', 'https://www.rf.se/rf-arbetar-med/trygg-inkluderande-och-jamstalld-idrott', '2026-10-15', true, false, 113, 'Egen svensk sammanfattning. Återpublicera inte originaltext eller originalbilder; länka till källan.'
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_articles WHERE original_url = 'https://www.rf.se/rf-arbetar-med/trygg-inkluderande-och-jamstalld-idrott')
ON CONFLICT DO NOTHING;

INSERT INTO public.knowledge_articles (id, slug, title_sv, title_original, summary_sv, learn_sv, try_next_sv, category, age_label, age_5_7, age_8_9, age_10, game_format_label, format_3v3, format_5v5, format_7v7, level, content_type, language, source_name, source_type, reading_minutes, coach_value, evidence_level, original_url, checked_date, is_published, featured, sort_order, copyright_note)
SELECT 'KB114', 'likvardiga-villkor-flickor-pojkar', 'Likvärdiga villkor för flickor och pojkar', NULL, 'RF:s publicerade jämställdhetsmål lyfter rättvis fördelning av träningstider, ledarkompetens, anläggningar, resurser och uppmärksamhet. Målsidan har målår 2025; den beskriver ambitioner och principer och visar inte att målen har uppnåtts.', 'Hur tränare kan granska vardagens resursfördelning och ge flickor och pojkar likvärdiga möjligheter att delta, utvecklas och påverka.', 'Jämför lagens träningstider, tillgång till ledare och utrustning tillsammans med föreningen. Lyssna på barnen och välj en konkret skillnad att åtgärda och följa upp.', 'Trygghet och inkludering', '5–10 år', true, true, true, '3 mot 3; 5 mot 5; 7 mot 7', true, true, true, 'Grund', 'Riktlinje och guide', 'Svenska', 'Riksidrottsförbundet', 'Svenskt kunskapsstöd', NULL, 'Stöd för tränargruppen', 'Officiella jämställdhetsmål med målår 2025, publicerade på en sida uppdaterad 2024. Vägledande principer, ingen effektutvärdering.', 'https://www.rf.se/rf-arbetar-med/trygg-inkluderande-och-jamstalld-idrott/jamstalldhet/jamstalldhetsmal', '2026-10-15', true, false, 114, 'Egen svensk sammanfattning. Återpublicera inte originaltext eller originalbilder; länka till källan.'
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_articles WHERE original_url = 'https://www.rf.se/rf-arbetar-med/trygg-inkluderande-och-jamstalld-idrott/jamstalldhet/jamstalldhetsmal')
ON CONFLICT DO NOTHING;

INSERT INTO public.knowledge_articles (id, slug, title_sv, title_original, summary_sv, learn_sv, try_next_sv, category, age_label, age_5_7, age_8_9, age_10, game_format_label, format_3v3, format_5v5, format_7v7, level, content_type, language, source_name, source_type, reading_minutes, coach_value, evidence_level, original_url, checked_date, is_published, featured, sort_order, copyright_note)
SELECT 'KB115', 'somn-aterhamtning-barnfotboll', 'Sömn och återhämtning i barnets vardag', NULL, '1177 beskriver hur sömn hjälper kroppen och hjärnan att återhämta sig och bearbeta nya upplevelser. Sömnbehovet varierar mellan åldrar och individer. Dagsljus, rörelse och lugna rutiner på kvällen kan stödja sömnen.', 'Varför träningsplaneringen behöver rymmas i barnets vardag och varför tränaren bör lyssna på återkommande trötthet i dialog med vårdnadshavare.', 'Gå igenom träningstider och hemresor med föräldragruppen så att det finns utrymme för kvällsrutiner. Anpassa kraven för ett trött barn. Hänvisa familjen till 1177 eller elevhälsan vid återkommande sömnproblem.', 'Kost, vätska och återhämtning', '5–10 år', true, true, true, '3 mot 3; 5 mot 5; 7 mot 7', true, true, true, 'Grund', 'Medicinsk guide', 'Svenska', '1177', 'Svenskt kunskapsstöd', NULL, 'Stöd för tränargruppen', 'Svensk medicinsk patientinformation för 0–18 år. Fotbollsrummets tillämpning gäller träningsplanering och är inget individuellt behandlingsråd.', 'https://www.1177.se/barn--gravid/att-ta-hand-om-barn/barns-somn/barns-somn-i-olika-aldrar/', '2026-10-15', true, false, 115, 'Egen svensk sammanfattning. Återpublicera inte originaltext eller originalbilder; länka till källan.'
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_articles WHERE original_url = 'https://www.1177.se/barn--gravid/att-ta-hand-om-barn/barns-somn/barns-somn-i-olika-aldrar/')
ON CONFLICT DO NOTHING;

COMMIT;
