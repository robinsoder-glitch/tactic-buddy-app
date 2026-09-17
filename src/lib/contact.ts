import { z } from "zod";

/** Delade gränser för kontaktformuläret – samma regler i klient och server. */
export const CONTACT_SUBJECT_MAX = 120;
export const CONTACT_MESSAGE_MAX = 2000;
export const CONTACT_MIN_MESSAGE = 10;

export const contactMessageSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Ämnet måste vara minst 3 tecken.")
    .max(CONTACT_SUBJECT_MAX, `Ämnet får vara högst ${CONTACT_SUBJECT_MAX} tecken.`),
  message: z
    .string()
    .trim()
    .min(CONTACT_MIN_MESSAGE, `Meddelandet måste vara minst ${CONTACT_MIN_MESSAGE} tecken.`)
    .max(CONTACT_MESSAGE_MAX, `Meddelandet får vara högst ${CONTACT_MESSAGE_MAX} tecken.`),
  /** Klientgenererat id så samma meddelande inte mejlas två gånger vid omskick. */
  clientId: z.string().uuid().optional(),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

/**
 * Enkel hastighetsgräns: max antal kontaktmejl per användare och tidsfönster.
 * Tröskeln är generös så att vanliga frågor aldrig stoppas.
 */
export const CONTACT_RATE_LIMIT = 5;
export const CONTACT_RATE_WINDOW_MS = 60 * 60 * 1000;

export type ContactRateBucket = { count: number; resetAt: number };

/**
 * Ren funktion för hastighetsgränsen – testbar utan timers.
 * Returnerar uppdaterad bucket, eller null om gränsen är nådd.
 */
export function nextContactRateBucket(
  bucket: ContactRateBucket | undefined,
  now: number,
): ContactRateBucket | null {
  if (!bucket || now >= bucket.resetAt) {
    return { count: 1, resetAt: now + CONTACT_RATE_WINDOW_MS };
  }
  if (bucket.count >= CONTACT_RATE_LIMIT) return null;
  return { count: bucket.count + 1, resetAt: bucket.resetAt };
}
