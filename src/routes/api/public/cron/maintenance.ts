import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Körs var 5:e minut av Lovable Cron: publicerar schemalagda meddelanden,
// återkallar utgångna laginbjudningar och rensar gamla flödeshändelser.
export const Route = createFileRoute("/api/public/cron/maintenance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        // Adminklienten laddas först efter att anropet verifierats.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();

        const { data: published, error: publishError } = await supabaseAdmin.rpc(
          "publish_scheduled_announcements",
        );
        if (publishError) console.error("[cron] publicering misslyckades", publishError);

        const { data: revoked, error: revokeError } = await supabaseAdmin
          .from("team_invites")
          .update({ revoked_at: now })
          .is("accepted_at", null)
          .is("revoked_at", null)
          .lt("expires_at", now)
          .select("id");
        if (revokeError) console.error("[cron] återkallning misslyckades", revokeError);

        // Flödeshändelser sparas i högst 90 dagar.
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { count: purged, error: purgeError } = await supabaseAdmin
          .from("invite_flow_events")
          .delete({ count: "exact" })
          .lt("created_at", cutoff);
        if (purgeError) console.error("[cron] rensning misslyckades", purgeError);

        const ok = !publishError && !revokeError && !purgeError;
        return Response.json(
          {
            success: ok,
            published: typeof published === "number" ? published : 0,
            revoked: revoked?.length ?? 0,
            purgedFlowEvents: purged ?? 0,
          },
          { status: ok ? 200 : 500 },
        );
      },
    },
  },
});
