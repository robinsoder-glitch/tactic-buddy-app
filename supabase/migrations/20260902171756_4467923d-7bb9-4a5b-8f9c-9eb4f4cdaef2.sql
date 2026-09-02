
-- 1. Retreatlinje: motståndare på egen halva vid egen målvaktsstart (t17)
update tb_tactics
set data = jsonb_set(
  jsonb_set(data, '{actors}', (
    select jsonb_agg(case when a->>'id'='a_high'
      then jsonb_set(jsonb_set(a,'{x}','5900'::jsonb),'{y}','3600'::jsonb) else a end)
    from jsonb_array_elements(data->'actors') a)),
  '{keyframes}', (
    select jsonb_agg(
      jsonb_set(k,'{actorPositions}', (
        select coalesce(jsonb_agg(case when p->>'actorId'='a_high'
          then jsonb_set(jsonb_set(p,'{x}','5900'::jsonb),'{y}','3600'::jsonb) else p end),'[]'::jsonb)
        from jsonb_array_elements(coalesce(k->'actorPositions','[]'::jsonb)) p)))
    from jsonb_array_elements(data->'keyframes') k))
where id = 't17_own_gk_restart_three_choices';

-- 2. Hörnspark tas från hörnflaggan (t19)
update tb_tactics
set data = jsonb_set(
  jsonb_set(data, '{actors}', (
    select jsonb_agg(case when a->>'id'='h_left'
      then jsonb_set(jsonb_set(a,'{x}','9950'::jsonb),'{y}','150'::jsonb) else a end)
    from jsonb_array_elements(data->'actors') a)),
  '{keyframes}', (
    select jsonb_agg(
      case when k->'ball'->>'attachedTo' = 'h_left'
        then jsonb_set(jsonb_set(k,'{ball,x}','9950'::jsonb),'{ball,y}','150'::jsonb)
        else k end)
    from jsonb_array_elements(data->'keyframes') k))
where id = 't19_short_corner';

-- 3. Tydlig källinformation på alla kort
update tb_tactics
set data = jsonb_set(data, '{sources}', jsonb_build_array(
  jsonb_build_object(
    'sourceType','editorial_synthesis',
    'title','Fotbollsrummets redaktion: taktikkort för 5 mot 5 (8–9 år). Innehållet är framtaget av oss, inte hämtat ur en publicerad övning.',
    'url','https://aktiva.svenskfotboll.se/tranare/spelformer/',
    'reviewedAt','2026-09-02',
    'licenseStatus','original-editorial'),
  jsonb_build_object(
    'sourceType','official_rule',
    'title','SvFF: Nationella spelformer – 5 mot 5, 8–9 år (2025)',
    'url','https://www.svenskfotboll.se/4916e2/globalassets/svff/dokumentdokumentblock/nationella-spelformer/5mot5-2025.pdf',
    'reviewedAt','2026-09-02',
    'licenseStatus','official-reference'),
  jsonb_build_object(
    'sourceType','official_rule',
    'title','SvFF: Spelregler för barn- och ungdomsfotboll – spelformen 5 mot 5',
    'url','https://www.svenskfotboll.se/spelregler',
    'reviewedAt','2026-09-02',
    'licenseStatus','official-reference')
));

-- 4. Regeltext på de kort som bygger på en spelregel
update tb_tactics set data = jsonb_set(data,'{ruleNote}', to_jsonb(r.note))
from (values
 ('t16_press_after_gk_restart','Retreatlinje: vid målvaktsutkast, eller när målvakten fångar bollen i spel, ska motståndarlaget backa till sin egen planhalva (mittlinjen är retreatlinje) och stanna där tills bollen har lämnat målvaktens händer.'),
 ('t17_own_gk_restart_three_choices','Målvaktsutkast: målvakten rullar eller kastar ut bollen, eller lägger ner bollen och driver/passar efter marken. Utspark och volleyspark är inte tillåtet. Mål kan inte göras direkt. Motståndarna står bakom retreatlinjen (mittlinjen) tills bollen lämnat händerna.'),
 ('t18_touchline_triangle','Sidlinjespark: spelet sätts i gång genom att driva bollen eller passa efter marken. Motståndarna ska stå minst fem meter från bollen. Mål kan inte göras direkt.'),
 ('t19_short_corner','Hörnspark: läggs från hörnet, sätts i gång genom att driva bollen eller passa efter marken. Motståndarna ska stå minst fem meter från bollen. Mål kan inte göras direkt.'),
 ('t20_four_goal_extra_player','Fyramålsregeln: vid underläge med fyra eller fler mål får laget som ligger under spela med fem utespelare tills båda lagen gjort lika många mål.')
) as r(id,note)
where tb_tactics.id = r.id;
