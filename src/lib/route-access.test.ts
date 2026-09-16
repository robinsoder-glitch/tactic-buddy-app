import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  COACH_ONLY_ROUTES,
  COACH_ONLY_RPCS,
  PLAYER_ROUTES,
  TEAM_COACH_ONLY_ROUTES,
  canOpenCoachPage,
} from "@/lib/route-access";

const ROUTE_DIR = join(process.cwd(), "src/routes/_authenticated");
const read = (file: string) => readFileSync(join(ROUTE_DIR, file), "utf8");
const routeFiles = readdirSync(ROUTE_DIR);

describe("behörighet: spelare och vårdnadshavare når inte tränarsidor", () => {
  it.each(COACH_ONLY_ROUTES)("%s spärras av CoachOnly", (file) => {
    const source = read(file);
    expect(source).toContain('from "@/components/CoachOnly"');
    expect(source).toMatch(/<CoachOnly>/);
  });

  it.each(TEAM_COACH_ONLY_ROUTES)("%s spärras av TeamCoachOnly", (file) => {
    const source = read(file);
    expect(source).toContain('from "@/components/TeamCoachOnly"');
    expect(source).toMatch(/<TeamCoachOnly teamId=/);
  });

  it("alla listade tränarsidor finns kvar i projektet", () => {
    for (const file of [...COACH_ONLY_ROUTES, ...TEAM_COACH_ONLY_ROUTES, ...PLAYER_ROUTES]) {
      expect(routeFiles).toContain(file);
    }
  });

  it("spelarnas egna sidor är inte spärrade", () => {
    for (const file of PLAYER_ROUTES) {
      const source = read(file);
      expect(source).not.toMatch(/<CoachOnly>/);
      expect(source).not.toMatch(/<TeamCoachOnly teamId=/);
    }
  });

  it("admin-sidan kräver adminbehörighet", () => {
    const source = read("admin.tsx");
    expect(source).toContain("isAdmin");
    expect(source).toContain("Du har inte behörighet till adminvyn.");
  });

  it("varje sida under träningspass ligger bakom layoutens spärr", () => {
    const layout = read("traningspass.$id.tsx");
    expect(layout).toMatch(/<CoachOnly>[\s\S]*<Outlet \/>[\s\S]*<\/CoachOnly>/);
  });

  it("regeln släpper bara in tränare och admin", () => {
    expect(canOpenCoachPage("coach")).toBe(true);
    expect(canOpenCoachPage("admin")).toBe(true);
    expect(canOpenCoachPage("player")).toBe(false);
    expect(canOpenCoachPage("guardian")).toBe(false);
  });
});

describe("behörighet: spärrsidorna visar väg tillbaka", () => {
  const coachOnly = readFileSync(join(process.cwd(), "src/components/CoachOnly.tsx"), "utf8");
  const teamCoachOnly = readFileSync(
    join(process.cwd(), "src/components/TeamCoachOnly.tsx"),
    "utf8",
  );

  it("CoachOnly förklarar varför och länkar till spelarens sidor", () => {
    expect(coachOnly).toContain("Bara för tränare");
    expect(coachOnly).toContain("spelar- eller vårdnadshavarkonto");
    expect(coachOnly).toContain('to="/kallelser"');
    expect(coachOnly).toContain("PLAYER_HOME_LINKS");
  });

  it("TeamCoachOnly länkar tillbaka till laget och kallelserna", () => {
    expect(teamCoachOnly).toContain("Den här sidan är för lagets ledare");
    expect(teamCoachOnly).toContain('to="/team/$teamId"');
    expect(teamCoachOnly).toContain('to="/kallelser"');
  });
});

describe("behörighet: databasfunktioner kontrollerar rollen", () => {
  const migrations = readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8"));

  it.each(COACH_ONLY_RPCS)("%s finns och gör en behörighetskontroll", (fn) => {
    const defs = migrations.filter((sql) => sql.includes(`FUNCTION public.${fn}(`));
    expect(defs.length).toBeGreaterThan(0);
    const latest = defs[defs.length - 1] as string;
    expect(latest).toMatch(/is_team_coach|can_manage_attendance|is_platform_admin|account_kind/);
  });
});
