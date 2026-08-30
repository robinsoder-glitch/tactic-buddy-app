import type { KnowledgeArticle } from "./knowledge";
import { knowledgeAgeLabel, knowledgeFormatLabel } from "./knowledge";

/** Delar upp en text i punkter: radbrytningar, listtecken eller meningar. */
export function toBullets(text: string | null | undefined, max = 5): string[] {
  if (!text) return [];
  const lines = text
    .split(/\r?\n|•|(?:^|\s)[-–]\s/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2);
  const source = lines.length > 1 ? lines : splitSentences(text);
  return source.slice(0, max).map((item) => item.replace(/\s+/g, " ").trim());
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2);
}

/** "Passar dig som ..." – vem artikeln är skriven för. */
export function fitsYouIf(article: KnowledgeArticle): string[] {
  const items: string[] = [];
  items.push(`tränar barn ${knowledgeAgeLabel(article).toLowerCase()}`);
  const format = knowledgeFormatLabel(article);
  if (format) items.push(`spelar ${format.toLowerCase()}`);
  if (article.category) items.push(`vill lära dig mer om ${article.category.toLowerCase()}`);
  if (article.level) items.push(`är på nivån ${article.level.toLowerCase()}`);
  if (article.reading_minutes) items.push(`har ${article.reading_minutes} minuter över`);
  return items;
}

/** Huvudbudskapen i artikeln. */
export function keyMessages(article: KnowledgeArticle): string[] {
  const bullets = [...toBullets(article.summary_sv, 4), ...toBullets(article.learn_sv, 4)];
  return dedupe(bullets).slice(0, 6);
}

/** Praktiska råd att använda direkt. */
export function practicalAdvice(article: KnowledgeArticle): string[] {
  const bullets = [...toBullets(article.try_next_sv, 5), ...toBullets(article.coach_value, 2)];
  return dedupe(bullets).slice(0, 6);
}

/** Ärlig lista över vad artikeln inte ger svar på. */
export function notCovered(article: KnowledgeArticle): string[] {
  const items: string[] = [];
  const ages: string[] = [];
  if (!article.age_5_7) ages.push("5–7 år");
  if (!article.age_8_9) ages.push("8–9 år");
  if (!article.age_10) ages.push("10 år och äldre");
  if (ages.length && ages.length < 3) items.push(`Den är inte skriven för ${ages.join(" eller ")}.`);

  const formats: string[] = [];
  if (!article.format_3v3) formats.push("3 mot 3");
  if (!article.format_5v5) formats.push("5 mot 5");
  if (!article.format_7v7) formats.push("7 mot 7");
  if (formats.length && formats.length < 3) items.push(`Den tar inte upp ${formats.join(" eller ")}.`);

  if (!article.try_next_sv) items.push("Den innehåller inga färdiga övningar – välj övningar i Övningsbanken.");
  if (article.evidence_level && /erfarenhet|praktik|åsikt/i.test(article.evidence_level)) {
    items.push("Den bygger på erfarenhet snarare än forskning – pröva råden i ditt eget lag.");
  }
  items.push("Den ersätter inte era egna riktlinjer i föreningen eller distriktets tävlingsregler.");
  return items;
}

/** Källa och granskning. */
export function sourceCheck(article: KnowledgeArticle): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (article.source_name) rows.push(["Källa", article.source_name]);
  if (article.source_type) rows.push(["Typ av källa", article.source_type]);
  if (article.evidence_level) rows.push(["Underlag", article.evidence_level]);
  if (article.language) rows.push(["Språk i original", article.language]);
  if (article.checked_date) rows.push(["Kontrollerad", article.checked_date]);
  return rows;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
