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

/** Hämtar en publik sida och gör om den till läsbar text. */
async function fetchPageText(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Länken ser inte ut att vara en fullständig webbadress.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Bara vanliga webbadresser (http/https) går att läsa in.");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host === "[::1]"
  ) {
    throw new Error("Den här adressen går inte att läsa in.");
  }

  const response = await fetch(url.toString(), {
    redirect: "follow",
    headers: { "User-Agent": "Fotbollsrummet matchimport" },
    signal: AbortSignal.timeout(20_000),
  });
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
