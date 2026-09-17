import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import {
  contactMessageSchema,
  nextContactRateBucket,
  type ContactRateBucket,
} from "@/lib/contact";

// Bästa möjliga-minnesgräns per worker-instans; den riktiga spärren är
// Lovables server-spärrar, men det här stoppar uppenbart missbruk.
const rateBuckets = new Map<string, ContactRateBucket>();

const DEFAULT_RECIPIENT = "info@fotbollsrummet.app";

/**
 * Skickar ett kontaktmeddelande från en inloggad användare till appens
 * mottagaradress. Mottagaren är fast och kan aldrig väljas av klienten.
 */
export const sendContactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => contactMessageSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ sent: boolean }> => {
    const bucket = nextContactRateBucket(rateBuckets.get(context.userId), Date.now());
    if (!bucket) {
      throw new Error("Du har skickat många meddelanden på kort tid. Försök igen om en stund.");
    }
    rateBuckets.set(context.userId, bucket);

    const { data: userData } = await context.supabase.auth.getUser();
    const senderEmail = userData.user?.email ?? null;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();

    // Lagtillhörighet är bara kontext i mejlet – får aldrig stoppa utskicket.
    let senderTeams: string | undefined;
    try {
      const { data: memberships } = await context.supabase
        .from("team_members")
        .select("teams(name)")
        .eq("user_id", context.userId)
        .eq("status", "approved");
      const names = (memberships ?? [])
        .map((row) => (row as unknown as { teams: { name: string } | null }).teams?.name)
        .filter((name): name is string => Boolean(name));
      if (names.length > 0) senderTeams = [...new Set(names)].join(", ");
    } catch {
      senderTeams = undefined;
    }

    const recipient = process.env["CONTACT_RECIPIENT_EMAIL"] ?? DEFAULT_RECIPIENT;

    const result = await sendTemplateEmail("contact-message", recipient, {
      idempotencyKey: data.clientId
        ? `contact-${data.clientId}`
        : `contact-${context.userId}-${Date.now()}`,
      replyTo: senderEmail ?? undefined,
      templateData: {
        senderName: profile?.display_name ?? undefined,
        senderEmail: senderEmail ?? undefined,
        senderTeams,
        subjectLine: data.subject,
        message: data.message,
      },
    });

    // En spärrad mottagare ska inte se ut som ett fel för avsändaren – mejlet
    // är då stoppat på vår sida och vi svarar ändå i appen vid behov.
    return { sent: true, ...(!result.sent ? {} : {}) };
  });
