-- Nivåjustering enligt granskning 2026-09-03
update public.knowledge_articles set level = 'Fortsättning', updated_at = now()
where id in ('KB002','KB035','KB036','KB037','KB038','KB041','KB047','KB051','KB053','KB054',
             'KB058','KB059','KB061','KB062','KB063','KB069','KB071','KB073','KB077','KB082',
             'KB084','KB086','KB088','KB090','KB091','KB092','KB094');

-- Återpublicera poster som ska finnas kvar men på rätt nivå/innehållstyp
update public.knowledge_articles set is_published = true, updated_at = now()
where id in ('KB051','KB052','KB054','KB083');

-- Avpublicera KB043 tills poddavsnittet är korrekt sammanfattat
update public.knowledge_articles set is_published = false, updated_at = now() where id = 'KB043';

-- Innehållstyper: portalsidor och verktyg ska inte se ut som artiklar
update public.knowledge_articles set content_type = 'Resursbank', updated_at = now()
where id in ('KB054','KB066','KB088');
update public.knowledge_articles set content_type = 'Verktyg', updated_at = now() where id = 'KB081';

-- Direktlänkar i stället för portalsidor
update public.knowledge_articles
set original_url = 'https://canadasoccer.com/wp-content/uploads/2026/02/CanadaSoccerPathway_CoachsToolKit_ActiveStart_EN.pdf',
    updated_at = now()
where id = 'KB053';
update public.knowledge_articles
set original_url = 'https://assets.dfb.de/uploads/000/282/720/original_DFB_TRAININGSDIALOG_2.pdf?1682579033=',
    updated_at = now()
where id = 'KB064';

-- Korrigerade sammanfattningar
update public.knowledge_articles set summary_sv =
'En systematisk översikt av 11 studier med över 10 000 barn, främst 7–14 år, fann att FIFA 11+ Kids var kopplat till omkring 50 procent färre skador och nära 60 procent färre allvarliga skador. Studiernas kvalitet varierade, så resultaten är stöd för regelbunden användning – inte en garanti för att skador försvinner.',
    updated_at = now() where id = 'KB048';

update public.knowledge_articles set summary_sv =
'I en dansk skolstudie tränade 295 barn i åldern 8–10 år smålagsspel med boll eller cirkelstyrka tre gånger 40 minuter i veckan under tio månader. Båda träningsformerna förbättrade flera mått på benhälsa, balans och hopp jämfört med kontrollgruppen, men inte sprint eller fettfri massa. Resultaten kan inte direkt översättas till vanlig lagträning.',
    updated_at = now() where id = 'KB050';

update public.knowledge_articles set summary_sv =
'För de yngsta bör tränaren främst organisera lekfulla fotbollsspel och låta barnen lära genom försök, misstag och mycket spel. Källan avråder från långa instruktioner, löprundor och vuxenstyrning och föreslår en enkel struktur: rolig start, bollaktiviteter och smålagsspel.',
    updated_at = now() where id = 'KB069';

update public.knowledge_articles set summary_sv =
'Riktlinjerna gäller främst talangfulla spelare under 17 år som tränar i flera miljöer. De rekommenderar vilodagar, minst 24 timmars återhämtning mellan fotbollspass, regelbunden styrketräning och en längre period utan organiserad fotboll. De ska inte presenteras som ett generellt veckoschema för yngre breddspelare.',
    updated_at = now() where id = 'KB072';

update public.knowledge_articles set summary_sv =
'New Zealand Football beskriver appen CoachMate: ett kostnadsfritt verktyg för färdiga och egna övningar, filmer, planering, närvaro, schema och lagchatt. Detta är en verktygsbeskrivning, inte en fristående kunskapsartikel.',
    updated_at = now() where id = 'KB081';

update public.knowledge_articles set summary_sv =
'RF-SISU beskriver rörelseförståelse som samspelet mellan motivation, trygghet, kunskap och fysisk förmåga. Materialet betonar en bred motorisk bas, variation, livslångt idrottande och de fem fysiska grundegenskaperna styrka, snabbhet, uthållighet, rörlighet och koordination.',
    category = 'Fysik och motorik',
    updated_at = now() where id = 'KB091';