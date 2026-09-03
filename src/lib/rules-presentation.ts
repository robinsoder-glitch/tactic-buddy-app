/**
 * Översätter regeldata från banken till vanlig svenska.
 * Ingen rå JSON, inga interna nycklar och inga tekniska fält lämnar den här filen.
 */

export const MISSING_TEXT = "Uppgiften saknas och behöver kontrolleras.";

export type VerificationLabel = "Verifierad" | "Behöver kontrolleras" | "Ej verifierad";

export type RuleSource = {
  title: string;
  url?: string | undefined;
  reviewedAt?: string | undefined;
};

export type RuleSection = {
  key: string;
  title: string;
  intro: string;
  value: string;
  help?: string | undefined;
  missing: boolean;
};

export type DistrictDeviation = {
  id: string;
  name: string;
  status: VerificationLabel;
  season?: string | undefined;
  /** Meningar av typen "I <distrikt> gäller i stället …" */
  lines: string[];
  notes: string[];
  source?: RuleSource | undefined;
  /** Endast synlig för admin när status inte är Verifierad. */
  adminOnly: boolean;
};

export type RulesPresentation = {
  formatLabel: string;
  seasonLabel: string;
  rulesetName: string;
  reviewedLabel: string;
  status: VerificationLabel;
  source?: RuleSource | undefined;
  sections: RuleSection[];
  districts: DistrictDeviation[];
};

type Json = Record<string, unknown>;

function obj(value: unknown): Json | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : undefined;
}
function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function str(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : undefined;
}
function range(value: unknown): string | undefined {
  const single = num(value);
  if (single !== undefined) return formatNumber(single);
  const record = obj(value);
  if (!record) return undefined;
  const min = num(record["min"]);
  const max = num(record["max"]);
  if (min !== undefined && max !== undefined)
    return min === max ? formatNumber(min) : `${formatNumber(min)}–${formatNumber(max)}`;
  return min !== undefined ? formatNumber(min) : max !== undefined ? formatNumber(max) : undefined;
}
function formatNumber(value: number): string {
  return String(value).replace(".", ",");
}

export function formatLabelFor(format: string | null | undefined): string {
  const match = /^(\d+)v(\d+)$/i.exec(format ?? "");
  if (match) return `${match[1]} mot ${match[2]}`;
  return str(format) ?? "Okänd spelform";
}

function formatDate(value: unknown): string | undefined {
  const text = str(value);
  if (!text) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("sv-SE");
}

function pickSource(data: Json): RuleSource | undefined {
  const list = Array.isArray(data["sources"]) ? (data["sources"] as unknown[]) : [];
  for (const item of list) {
    const record = obj(item);
    const title = str(record?.["title"]);
    if (!title) continue;
    return { title, url: str(record?.["url"]), reviewedAt: str(record?.["reviewedAt"]) };
  }
  return undefined;
}

function section(
  key: string,
  title: string,
  intro: string,
  value: string | undefined,
  help?: string,
): RuleSection {
  const missing = !value;
  return {
    key,
    title,
    intro,
    value: value ?? MISSING_TEXT,
    help: missing ? undefined : help,
    missing,
  };
}

function playersText(data: Json): string | undefined {
  const players = obj(data["players"]);
  const outfield = num(players?.["outfield"]);
  const keepers = num(players?.["goalkeepers"]);
  if (outfield === undefined && keepers === undefined) return undefined;
  const parts: string[] = [];
  if (outfield !== undefined) parts.push(`${outfield} utespelare`);
  if (keepers !== undefined) parts.push(keepers === 1 ? "1 målvakt" : `${keepers} målvakter`);
  return parts.join(" och ");
}

function pitchText(data: Json): string | undefined {
  const pitch = obj(data["pitch"]);
  const goal = obj(data["goal"]);
  const length = range(pitch?.["lengthM"]);
  const width = range(pitch?.["widthM"]);
  const goalWidth = num(goal?.["widthM"]);
  const goalHeight = num(goal?.["heightM"]);
  const parts: string[] = [];
  if (length && width) parts.push(`Planen är ${length} meter lång och ${width} meter bred`);
  if (goalWidth !== undefined && goalHeight !== undefined)
    parts.push(`målen är ${formatNumber(goalWidth)} × ${formatNumber(goalHeight)} meter`);
  if (parts.length === 0) return undefined;
  return `${parts.join(", ")}.`;
}

function durationText(data: Json): string | undefined {
  const list = Array.isArray(data["matchDurations"]) ? (data["matchDurations"] as unknown[]) : [];
  const contextLabels: Record<string, string> = {
    sammandrag: "Vid sammandrag",
    enskild_match: "Vid enskild match",
  };
  const lines = list
    .map((item) => {
      const record = obj(item);
      const periods = num(record?.["periods"]);
      const minutes = num(record?.["minutesPerPeriod"]);
      if (periods === undefined || minutes === undefined) return undefined;
      const contextKey = str(record?.["context"]);
      const contextText = contextKey ? (contextLabels[contextKey] ?? "Vid match") : "Vid match";
      return `${contextText}: ${periods} × ${minutes} minuter`;
    })
    .filter((line): line is string => Boolean(line));
  return lines.length > 0 ? lines.join(". ") + "." : undefined;
}

function keeperText(data: Json): string | undefined {
  const parts: string[] = [];
  const punt = data["goalkeeperPuntAllowed"];
  const backpass = data["goalkeeperBackpassHandsAllowed"];
  if (typeof punt === "boolean")
    parts.push(
      punt
        ? "Målvakten får utkast och utspark i luften."
        : "Målvakten får inte sparka bollen i luften – spelet startas på marken.",
    );
  if (typeof backpass === "boolean")
    parts.push(
      backpass
        ? "Målvakten får ta upp bollen med händerna vid tillbakaspel från medspelare."
        : "Målvakten får inte ta upp bollen med händerna vid tillbakaspel från medspelare.",
    );
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function retreatText(data: Json): string | undefined {
  const retreat = obj(data["retreatLine"]);
  if (!retreat) return undefined;
  const enabled = retreat["enabled"];
  if (enabled === false) return "Retreatlinje används inte i den här spelformen.";
  const position = str(retreat["position"]);
  const release = str(retreat["releaseCondition"]);
  const quick = retreat["quickRestartAllowed"];
  const parts: string[] = [];
  if (position) parts.push(`Retreatlinjen ligger vid ${position}.`);
  if (release) parts.push(release);
  if (typeof quick === "boolean")
    parts.push(
      quick ? "Snabb igångsättning är tillåten." : "Snabb igångsättning är inte tillåten.",
    );
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function setPiecesText(data: Json): string | undefined {
  const pieces = obj(data["setPieces"]);
  if (!pieces) return undefined;
  const labels: Record<string, string> = {
    freeKicks: "Frisparkar",
    corner: "Hörnor",
    penaltyKick: "Straff",
    touchlineRestart: "Igångsättning vid sidlinjen",
  };
  const lines = Object.entries(labels)
    .map(([key, label]) => {
      const text = str(pieces[key]);
      return text ? `${label}: ${text}` : undefined;
    })
    .filter((line): line is string => Boolean(line));
  return lines.length > 0 ? lines.join("\n") : undefined;
}

function ageText(data: Json): string | undefined {
  const age = obj(data["ageRange"]);
  const min = num(age?.["min"]);
  const max = num(age?.["max"]);
  if (min === undefined && max === undefined) return undefined;
  if (min !== undefined && max !== undefined)
    return `Spelformen används för spelare ${min}–${max} år.`;
  return `Spelformen används från ${min ?? max} år.`;
}

const STATUS_BY_RAW: Record<string, VerificationLabel> = {
  verified: "Verifierad",
  "verified-rulebook-only": "Behöver kontrolleras",
  "needs-verification": "Ej verifierad",
  unverified: "Ej verifierad",
};

export function districtStatus(raw: unknown): VerificationLabel {
  const key = str(raw)?.toLowerCase();
  return (key && STATUS_BY_RAW[key]) || "Ej verifierad";
}

const OVERRIDE_SENTENCE: Record<string, (value: unknown) => string | undefined> = {
  pitch: (value) => {
    const record = obj(value);
    const length = range(record?.["lengthM"]);
    const width = range(record?.["widthM"]);
    if (!length || !width) return undefined;
    return `planen ska vara ${length} × ${width} meter`;
  },
  sargOrNetAlternative: (value) => {
    const record = obj(value);
    const length = range(record?.["lengthM"]);
    const width = range(record?.["widthM"]);
    if (!length || !width) return undefined;
    return `med sarg eller nät får planen vara ${length} × ${width} meter`;
  },
  competitionFormat: (value) => {
    const text = str(value);
    return text ? `tävlingsformen är ${text}` : undefined;
  },
  generalOverageDispensation: (value) => {
    const count = num(value);
    return count === undefined ? undefined : `${count} generella överårsdispenser tillåts`;
  },
};

export function buildDistrictDeviation(profile: {
  id: string;
  name: string;
  data: Json;
}): DistrictDeviation {
  const data = profile.data ?? {};
  const status = districtStatus(data["verificationStatus"]);
  const overrides = obj(data["overrides"]) ?? {};
  const lines = Object.entries(overrides)
    .map(([key, value]) => {
      const build = OVERRIDE_SENTENCE[key];
      const sentence = build?.(value);
      return sentence ? `I ${profile.name} gäller i stället ${sentence}.` : undefined;
    })
    .filter((line): line is string => Boolean(line));
  const notes = (
    Array.isArray(data["competitionNotes"]) ? (data["competitionNotes"] as unknown[]) : []
  )
    .map((note) => str(note))
    .filter((note): note is string => Boolean(note));
  return {
    id: profile.id,
    name: str(profile.name) ?? "Distrikt",
    status,
    season: str(data["season"]) === "unverified" ? undefined : str(data["season"]),
    lines,
    notes,
    source: pickSource(data),
    adminOnly: status !== "Verifierad",
  };
}

export function buildRulesPresentation(
  ruleset: { id: string; format: string; season: string | null; data: Json },
  districtProfiles: { id: string; name: string; data: Json }[] = [],
): RulesPresentation {
  const data = ruleset.data ?? {};
  const source = pickSource(data);
  const formatLabel = formatLabelFor(ruleset.format ?? (data["format"] as string));

  const districts = districtProfiles
    .filter((profile) => str((profile.data ?? {})["inheritsRuleset"]) === ruleset.id)
    .map(buildDistrictDeviation);

  const localLines = districts
    .filter((district) => !district.adminOnly)
    .flatMap((district) => district.lines);

  const sections: RuleSection[] = [
    section("lag-alder", "Lag och ålder", "Vilka åldrar spelformen är till för.", ageText(data)),
    section(
      "antal-spelare",
      "Antal spelare",
      "Så många spelare laget har på planen samtidigt.",
      playersText(data),
      str(obj(data["players"])?.["substitutions"])
        ? `Byten: ${str(obj(data["players"])?.["substitutions"])}`
        : undefined,
    ),
    section(
      "plan-mal",
      "Plan och mål",
      "Planens mått och målens storlek.",
      pitchText(data),
      obj(data["pitch"])?.["penaltyAreaMarked"] === false
        ? "Straffområde markeras inte i den här spelformen."
        : obj(data["pitch"])?.["penaltyAreaMarked"] === true
          ? "Straffområde markeras på planen."
          : undefined,
    ),
    section("matchtid", "Matchtid", "Hur länge matchen spelas.", durationText(data)),
    section("malvakt", "Målvakt", "Vad målvakten får och inte får göra.", keeperText(data)),
    section(
      "retreatlinje",
      "Retreatlinje",
      "Var motståndarna ska stå när målvakten sätter igång spelet.",
      retreatText(data),
    ),
    section(
      "fasta-situationer",
      "Fasta situationer",
      "Frisparkar, hörnor och igångsättningar.",
      setPiecesText(data),
    ),
    section(
      "fyramalsregeln",
      "Fyramålsregeln",
      "Regeln som jämnar ut matchen när ett lag leder stort.",
      str(data["fourGoalRule"]),
    ),
    section(
      "lokala-avvikelser",
      "Viktiga lokala avvikelser",
      "Skillnader som gäller i ditt distrikt.",
      localLines.length > 0 ? localLines.join("\n") : undefined,
      "Kontrollera alltid distriktets tävlingsföreskrifter inför säsongen.",
    ),
  ];

  const anyMissing = sections.some((item) => item.missing);
  const status: VerificationLabel = !source
    ? "Ej verifierad"
    : anyMissing
      ? "Behöver kontrolleras"
      : "Verifierad";

  return {
    formatLabel,
    seasonLabel: str(ruleset.season) ?? str(data["season"]) ?? MISSING_TEXT,
    rulesetName: `Svensk Fotbolls spelform ${formatLabel}`,
    reviewedLabel: formatDate(source?.reviewedAt) ?? MISSING_TEXT,
    status,
    source,
    sections,
    districts,
  };
}
