/**
 * Översätter tekniska fel till begripliga svenska meddelanden.
 * Vanliga användare ska aldrig se rå JSON, databas-id, SQL eller stack traces.
 */

const PATTERNS: { test: RegExp; message: string }[] = [
  {
    test: /invalid login credentials|invalid_credentials/i,
    message: "Fel e-post eller lösenord. Har du glömt lösenordet kan du återställa det.",
  },
  {
    test: /email not confirmed/i,
    message: "Bekräfta din e-postadress via länken i mejlet innan du loggar in.",
  },
  {
    test: /password is known to be weak|weak password/i,
    message: "Lösenordet är för lätt att gissa. Välj ett längre och mer unikt lösenord.",
  },
  {
    test: /row-level security|permission denied|not authorized|violates row/i,
    message: "Du har inte behörighet till det här.",
  },
  {
    test: /duplicate key|already exists|23505/i,
    message: "Det finns redan en post med de uppgifterna.",
  },
  {
    test: /foreign key|23503/i,
    message: "Uppgiften används på annat håll och kan inte ändras just nu.",
  },
  {
    test: /failed to fetch|network|timeout|offline/i,
    message: "Ingen kontakt med servern. Kontrollera nätet och försök igen.",
  },
  {
    test: /jwt|token|session|not authenticated/i,
    message: "Din inloggning har gått ut. Logga in igen.",
  },
  { test: /not found|no rows/i, message: "Vi hittade inte det du letade efter." },
];

/** Sant om texten ser ut som ett tekniskt meddelande som inte bör visas. */
export function looksTechnical(message: string): boolean {
  if (!message.trim()) return true;
  return /undefined|null|\bat \w+ \(|https?:\/\/|[{}[\]]|select |insert |update |delete from|_id\b|error code|pgrst|supabase/i.test(
    message,
  );
}

export function friendlyError(error: unknown, fallback = "Något gick fel. Försök igen."): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "";

  for (const pattern of PATTERNS) {
    if (pattern.test.test(raw)) return pattern.message;
  }
  // Svenska meddelanden vi själva skrivit får visas som de är.
  if (raw && !looksTechnical(raw) && raw.length < 160) return raw;
  return fallback;
}
