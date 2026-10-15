import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KnowledgeArticleBody } from "./KnowledgeArticleBody";
import type { KnowledgeArticle } from "@/lib/knowledge";

const article = {
  summary_sv: "Vad källan beskriver.",
  learn_sv: "Vad tränaren lär sig.",
  try_next_sv: "Ett praktiskt förslag.",
  source_name: "Forskningstidskrift",
  source_type: "Vetenskaplig tidskrift",
  content_type: "Vetenskaplig pilotstudie",
  evidence_level: "Liten studie utan kontrollgrupp.",
  language: "Engelska",
  checked_date: "2026-10-15",
  category: "Fysik och motorik",
} as KnowledgeArticle;

describe("artikelns källstöd och tillämpning", () => {
  it("visar begränsningarna och det praktiska förslaget som tidigare doldes", () => {
    const html = renderToStaticMarkup(<KnowledgeArticleBody article={article} />);
    expect(html).toContain("Liten studie utan kontrollgrupp.");
    expect(html).toContain("Ett praktiskt förslag.");
    expect(html).toContain("Fotbollsrummets förslag till tillämpning");
    expect(html).toContain("Vetenskaplig pilotstudie");
    expect(html).not.toContain("Passar dig som");
  });
  it("förklarar utländska matchreglers räckvidd och länkar till svensk regelkälla", () => {
    const html = renderToStaticMarkup(
      <KnowledgeArticleBody
        article={{
          ...article,
          category: "Match och spelformer",
          source_name: "FA Wales",
        }}
      />,
    );
    expect(html).toContain("andra regler och åldersindelningar");
    expect(html).toContain("https://aktiva.svenskfotboll.se/tranare/spelformer/spelregler/");
  });
  it("visar ingen tom sektion när praktiska råd saknas", () => {
    const html = renderToStaticMarkup(
      <KnowledgeArticleBody
        article={{
          ...article,
          try_next_sv: null,
          learn_sv: " ",
          evidence_level: null,
        }}
      />,
    );
    expect(html).not.toContain("Pröva i ditt lag");
    expect(html).not.toContain("Det här tar du med dig");
    expect(html).toContain("Underlagets karaktär är ännu inte beskriven");
  });
});
