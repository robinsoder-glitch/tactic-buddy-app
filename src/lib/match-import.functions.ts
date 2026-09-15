import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { RawImportedMatch } from "@/lib/match-import";

const Input = z
  .object({
    /** Filens innehåll som base64 (utan data:-prefix). */
    fileBase64: z.string().min(1).max(12_000_000).nullable(),
    fileMime: z.string().min(3).max(120).nullable(),
    fileName: z.string().max(200).nullable(),
    url: z.string().max(2000).nullable(),
    teamName: z.string().max(120),
  })
  .refine((value) => Boolean(value.fileBase64) || Boolean(value.url), {
    message: "Ange en fil eller en länk.",
  });

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
]);

const MODEL = "google/gemini-3.8-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string" },
          time: { type: "string" },
          home_team: { type: "string" },
          away_team: { type: "string" },
          location: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["date", "time", "home_team", "away_team", "location", "confidence"],
      },
    },
  },
  required: ["matches"],
} as const;

/**
 * Släpper bara igenom publika webbadresser. Interna namn, IP-adresser och
 * inloggningsuppgifter i länken stoppas, så importen inte kan användas för att
 * nå tjänster inne i vårt eget nät.
 */
export function assertPublicUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Länken ser inte ut att vara en fullständig webbadress.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Bara vanliga webbadresser (http/https) går att läsa in.");
  }
  if (url.username || url.password) {
    throw new Error("Länkar med inloggningsuppgifter går inte att läsa in.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const blockedSuffix = [".local", ".internal", ".localhost", ".home.arpa"];
  if (
    host === "localhost" ||
    !host.includes(".") ||
    blockedSuffix.some((suffix) => host.endsWith(suffix)) ||
    host.startsWith("[") || // IPv6-literal
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || // alla IPv4-literaler
    /^\d+$/.test(host) ||
    /^0x/i.test(host)
  ) {
    throw new Error("Den här adressen går inte att läsa in.");
  }
  return url;
}

/** Expanderar en IPv6-adress till åtta hexgrupper. Null när formatet inte är IPv6. */
function expandIpv6(value: string): number[] | null {
  if (!value.includes(":")) return null;
  const zone = value.split("%")[0] ?? value;
  const halves = zone.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (!part) return [];
    const out: number[] = [];
    for (const group of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      out.push(parseInt(group, 16));
    }
    return out;
  };
  const head = parse(halves[0] ?? "");
  const tail = halves.length === 2 ? parse(halves[1] ?? "") : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array.from({ length: missing }, () => 0), ...tail];
}

/** Sant för adresser i privata eller lokala nät. */
export function isPrivateAddress(address: string): boolean {
  const value = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (value.includes(".") && value.includes(":")) {
    // Blandform, t.ex. ::ffff:127.0.0.1
    const last = value.slice(value.lastIndexOf(":") + 1);
    if (isPrivateAddress(last)) return true;
  }
  const groups = expandIpv6(value);
  if (!groups) return false;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const leadingZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  // ::, ::1 och fullt utskriven loopback
  if (leadingZero && g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true;
  // IPv4-mappade och IPv4-kompatibla adresser, även i hexform
  if (leadingZero && (g5 === 0xffff || g5 === 0)) {
    const ipv4Text = [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff].join(".");
    return isPrivateAddress(ipv4Text);
  }
  // Unika lokala adresser (fc00::/7) och länklokala (fe80::/10)
  if ((g0 & 0xfe00) === 0xfc00) return true;
  if ((g0 & 0xffc0) === 0xfe80) return true;
  return false;
}

/**
 * Slår upp värdnamnet och stoppar adresser som pekar in i ett privat nät.
 * Saknas namnuppslag i körmiljön görs ingen extra kontroll.
 */
async function assertPublicResolution(host: string): Promise<void> {
  let lookup:
    ((hostname: string, options: { all: true }) => Promise<{ address: string }[]>) | null = null;
  try {
    ({ lookup } = (await import("node:dns/promises")) as unknown as {
      lookup: (hostname: string, options: { all: true }) => Promise<{ address: string }[]>;
    });
  } catch {
    return;
  }
  if (!lookup) return;
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new Error("Den här adressen går inte att läsa in.");
  }
  if (records.length === 0) {
    throw new Error("Den här adressen går inte att läsa in.");
  }
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Den här adressen går inte att läsa in.");
  }
}

/** Hämtar en publik sida och gör om den till läsbar text. */
async function fetchPageText(rawUrl: string): Promise<string> {
  // Omdirigeringar följs manuellt så varje ny adress kontrolleras på nytt.
  let url = assertPublicUrl(rawUrl);
  let response: Response | null = null;
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublicResolution(url.hostname);
    response = await fetch(url.toString(), {
      redirect: "manual",
      headers: { "User-Agent": "Fotbollsrummet matchimport" },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      url = assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }
  if (!response) {
    throw new Error("Sidan gick inte att hämta. Ladda upp en PDF i stället.");
  }
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Sidan skickar vidare för många gånger. Ladda upp en PDF i stället.");
  }
  if (!response.ok) {
    throw new Error(`Sidan svarade med fel (${response.status}). Ladda upp en PDF i stället.`);
  }
  const html = (await response.text()).slice(0, 900_000);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60_000);
  if (text.length < 40) {
    throw new Error(
      "Sidan innehöll ingen läsbar text – den kräver troligen inloggning. Ladda upp en PDF i stället.",
    );
  }
  return text;
}

function instruction(teamName: string, today: string) {
  return [
    "Du läser ett spelschema för ett ungdomslag i fotboll och plockar ut alla matcher.",
    `Lagets namn är "${teamName}". Dagens datum är ${today}.`,
    "Svara med JSON enligt schemat. Ett fält du inte hittar lämnas som tom sträng.",
    "date skrivs som ÅÅÅÅ-MM-DD om året framgår, annars DD/MM.",
    "time skrivs som TT:MM. location är plan eller adress.",
    "confidence är 0-1 och hur säker du är på raden.",
    "Ta inte med träningar, cuper utan datum, tabeller eller resultat som redan spelats.",
  ].join(" ");
}

/** Läser ett spelschema (PDF, bild eller länk) och returnerar matchförslag. */
export const parseMatchSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI-tjänsten är inte konfigurerad.");

    const today = new Date().toISOString().slice(0, 10);
    const content: Record<string, unknown>[] = [
      { type: "text", text: instruction(data.teamName, today) },
    ];

    if (data.fileBase64) {
      const mime = (data.fileMime ?? "").toLowerCase();
      if (!ALLOWED_MIME.has(mime)) {
        throw new Error("Bara PDF eller bild (PNG/JPG/WEBP) går att läsa in.");
      }
      if (mime === "application/pdf") {
        content.push({
          type: "file",
          file: {
            filename: data.fileName || "schema.pdf",
            file_data: `data:${mime};base64,${data.fileBase64}`,
          },
        });
      } else {
        content.push({
          type: "image_url",
          image_url: { url: `data:${mime};base64,${data.fileBase64}` },
        });
      }
    } else {
      const text = await fetchPageText(data.url!);
      content.push({ type: "text", text: `Innehåll från sidan:\n${text}` });
    }

    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content }],
        response_format: {
          type: "json_schema",
          json_schema: { name: "matches", strict: true, schema: SCHEMA },
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 429) {
        throw new Error("För många förfrågningar just nu. Försök igen om en liten stund.");
      }
      if (response.status === 402) {
        throw new Error("AI-krediterna är slut. Fyll på krediter i Lovable och försök igen.");
      }
      if (response.status === 403) {
        throw new Error("AI-funktionen är avstängd för den här arbetsytan.");
      }
      throw new Error(`Kunde inte läsa schemat (${response.status}). ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Svaret gick inte att tolka. Försök igen eller ladda upp en tydligare PDF.");
    }
    const result = z
      .object({
        matches: z
          .array(
            z.object({
              date: z.string().optional(),
              time: z.string().optional(),
              home_team: z.string().optional(),
              away_team: z.string().optional(),
              location: z.string().optional(),
              confidence: z.number().optional(),
            }),
          )
          .max(200),
      })
      .safeParse(parsed);
    if (!result.success) {
      throw new Error("Svaret hade fel format. Försök igen.");
    }
    return { matches: result.data.matches as RawImportedMatch[] };
  });
