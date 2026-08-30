import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../src", import.meta.url));

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const FILES = collect(ROOT).filter(
  (file) => !file.includes("integrations/supabase") && !file.endsWith("routeTree.gen.ts"),
);

describe("Sista svarsdag visas inte i gränssnittet", () => {
  it("ingen fil innehåller texten 'Sista svarsdag'", () => {
    const hits = FILES.filter((file) => readFileSync(file, "utf8").includes("Sista svarsdag"));
    expect(hits).toEqual([]);
  });

  it("ingen vy läser eller skriver respond_by", () => {
    const hits = FILES.filter((file) => {
      if (!file.endsWith(".tsx")) return false;
      const source = readFileSync(file, "utf8");
      return source.includes("respondBy") || source.includes("respond_by");
    });
    expect(hits).toEqual([]);
  });
});
