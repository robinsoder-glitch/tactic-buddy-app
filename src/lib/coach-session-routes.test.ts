import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SESSION_STATUS_LABELS } from "./coach-sessions";

const read = (path: string) => readFileSync(path, "utf8");

describe("mina träningspass – rutter och presentationsläge", () => {
  it("har en layoutrutt som renderar undersidor", () => {
    const layout = read("src/routes/_authenticated/traningspass.$id.tsx");
    expect(layout).toContain('createFileRoute("/_authenticated/traningspass/$id")');
    expect(layout).toContain("<Outlet />");
  });

  it("har redigeringsvyn som indexrutt under passet", () => {
    const builder = read("src/routes/_authenticated/traningspass.$id.index.tsx");
    expect(builder).toContain('createFileRoute("/_authenticated/traningspass/$id/")');
    expect(builder).toContain("Markera som genomfört");
    expect(builder).toContain("Visa träningspass");
  });

  it("har presentationsvyn med utskrift och länkar till bankerna", () => {
    const view = read("src/routes/_authenticated/traningspass.$id.visa.tsx");
    expect(view).toContain('createFileRoute("/_authenticated/traningspass/$id/visa")');
    expect(view).toContain("Skriv ut eller spara som PDF");
    expect(view).toContain("Redigera träningspass");
    expect(view).toContain("print-area");
    expect(view).toContain("/kunskapsbank/$slug");
    expect(view).toContain("/taktikbank/$cardId");
  });

  it("döljer navigering vid utskrift", () => {
    const css = read("src/styles.css");
    expect(css).toContain("@media print");
    expect(css).toContain(".print-area");
  });

  it("har svenska statusetiketter", () => {
    expect(SESSION_STATUS_LABELS["draft"]).toBe("Utkast");
    expect(SESSION_STATUS_LABELS["done"]).toBe("Genomfört");
  });

  it("kan lägga till innehåll i träningspass direkt från listvyerna", () => {
    expect(read("src/routes/_authenticated/taktikbank.index.tsx")).toContain("AddToTrainingButton");
    expect(read("src/routes/_authenticated/ovningsbank.index.tsx")).toContain("PickDrillButton");
  });

  it("har inga tilläggsknappar i Kunskapsbanken", () => {
    expect(read("src/components/KnowledgeLibrary.tsx")).not.toContain("AddToTrainingButton");
    expect(read("src/routes/_authenticated/kunskapsbank.$slug.tsx")).not.toContain(
      "AddToTrainingButton",
    );
  });

  it("kan koppla en träning till kalendern", () => {
    expect(read("src/routes/_authenticated/traningspass.$id.index.tsx")).toContain(
      "SessionSharing",
    );
    expect(read("src/components/SessionSharing.tsx")).toContain("Koppla till kalendern");
  });
});
