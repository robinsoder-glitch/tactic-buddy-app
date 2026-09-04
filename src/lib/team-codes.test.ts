import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const migrations = readdirSync("supabase/migrations")
  .map((file) => read(`supabase/migrations/${file}`))
  .join("\n");

describe("lagkoder", () => {
  it("hämtas inte längre med lagets vanliga uppgifter", () => {
    const teams = read("src/lib/teams.ts");
    const selects = teams.match(/\.select\(\s*"[^"]*"/g) ?? [];
    for (const select of selects) {
      expect(select).not.toContain("join_code");
    }
    expect(teams).not.toContain("coach_join_code: string;\n");
  });

  it("hämtas via den skyddade databasfunktionen", () => {
    const teams = read("src/lib/teams.ts");
    expect(teams).toContain('supabase.rpc("get_team_codes"');
    expect(teams).toContain("export async function fetchTeamCodes");
  });

  it("visas bara på lagsidan och adminsidan, via funktionen", () => {
    const about = read("src/routes/_authenticated/team.$teamId.about.tsx");
    expect(about).toContain("fetchTeamCodes");
    expect(about).not.toContain("team.data?.join_code");
    expect(read("src/routes/_authenticated/teams.tsx")).not.toContain("join_code");
    expect(read("src/routes/_authenticated/admin.lag.index.tsx")).not.toContain("join_code");
    expect(read("src/routes/_authenticated/admin.lag.$teamId.tsx")).toContain("fetchTeamCodes");
  });

  it("admin läser inte hela lagraden längre", () => {
    const admin = read("src/lib/admin-data.ts");
    expect(admin).not.toContain('from("teams").select("*")');
    expect(admin).not.toContain("join_code");
  });

  it("har en migration som stänger kolumnerna och kräver tränarbehörighet", () => {
    expect(migrations).toContain("REVOKE SELECT, UPDATE ON public.teams FROM anon, authenticated");
    expect(migrations).toMatch(/CREATE OR REPLACE FUNCTION public\.get_team_codes/);
    expect(migrations).toContain("is_platform_admin(uid)");
    expect(migrations).toContain("Endast lagets tränare kan se lagets koder.");
    expect(migrations).toContain("UPDATE public.teams SET coach_join_code = public.gen_team_code()");
  });
});
