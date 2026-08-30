import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarDays, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  NO_ACCOUNT_TEXT,
  canRespondSelf,
  fetchMyInvitations,
  inviteStatusLabel,
  respondToInvitation,
  type InviteStatus,
  type MyInvitation,
} from "@/lib/invitations";
import { formatDateTime } from "@/lib/teams";
import { useAccount } from "@/hooks/useAccount";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/mina-kallelser")({
  head: () => ({
    meta: [
      { title: "Mina kallelser – svara på träningar och matcher" },
      {
        name: "description",
        content:
          "Se dina kallelser till träningar och matcher, och svara om du kommer, inte kommer eller kanske kommer.",
      },
      { property: "og:title", content: "Mina kallelser" },
      { property: "og:description", content: "Svara på kallelser till träningar och matcher." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyInvitesPage,
});

function MyInvitesPage() {
  const { userId } = useAccount();
  const queryClient = useQueryClient();
  const [showPast, setShowPast] = useState(false);

  const invites = useQuery({ queryKey: ["my-invitations"], queryFn: fetchMyInvitations });

  const respond = useMutation({
    mutationFn: ({ invitation, status }: { invitation: MyInvitation; status: InviteStatus }) => {
      if (!userId) throw new Error("Du måste vara inloggad.");
      return respondToInvitation({ invitation, status, userId, role: "player" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-invitations"] }),
    onError: () => toast.error("Kunde inte spara svaret. Försök igen."),
  });

  const now = Date.now();
  const all = invites.data ?? [];
  const upcoming = all.filter((item) => new Date(item.event.starts_at).getTime() >= now);
  const past = all
    .filter((item) => new Date(item.event.starts_at).getTime() < now)
    .sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at));
  const list = showPast ? past : upcoming;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <h1 className="font-display text-3xl font-bold">Mina kallelser</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Svara på kallelser till dina träningar och matcher.
      </p>

      <div className="mt-4 flex gap-2">
        <Button size="sm" variant={showPast ? "ghost" : "default"} onClick={() => setShowPast(false)}>
          Kommande ({upcoming.length})
        </Button>
        <Button size="sm" variant={showPast ? "default" : "ghost"} onClick={() => setShowPast(true)}>
          Tidigare ({past.length})
        </Button>
      </div>

      {invites.isError && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">Dina kallelser kunde inte hämtas just nu.</p>
          <Button size="sm" className="mt-2" onClick={() => invites.refetch()}>
            Försök igen
          </Button>
        </div>
      )}

      {!invites.isLoading && !invites.isError && list.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {showPast ? "Inga tidigare kallelser." : "Du har inga kallelser just nu."}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {list.map((invitation) => {
          const cancelled = Boolean(invitation.event.cancelled_at);
          const mine = canRespondSelf(invitation, userId);
          return (
            <li key={invitation.id} className="rounded-2xl border border-border bg-card p-4">
              {cancelled && (
                <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
                  <Ban className="size-3.5" /> Inställd
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {invitation.event.type === "match" ? "Match" : "Träning"}
                {invitation.teamName ? ` · ${invitation.teamName}` : ""}
              </p>
              <h2 className="font-display text-xl font-semibold">
                {invitation.event.title ??
                  (invitation.event.type === "match"
                    ? `${invitation.event.home_team ?? "Hemma"} – ${invitation.event.away_team ?? "Borta"}`
                    : "Träning")}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-4" />
                  {formatDateTime(invitation.event.starts_at)}
                </span>
                {invitation.event.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" />
                    {invitation.event.location}
                  </span>
                )}
              </p>
              {invitation.respond_by && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sista svarsdag: {invitation.respond_by}
                </p>
              )}
              {invitation.message && <p className="mt-2 text-sm">{invitation.message}</p>}
              <p className="mt-2 text-sm font-semibold">
                Ditt svar: {inviteStatusLabel(invitation.status)}
              </p>

              {mine && !cancelled ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["attending", "declined", "maybe"] as InviteStatus[]).map((status) => (
                    <Button
                      key={status}
                      className="h-12"
                      variant={invitation.status === status ? "default" : "secondary"}
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ invitation, status })}
                    >
                      {inviteStatusLabel(status)}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  {cancelled ? "Aktiviteten är inställd. Nya svar är stängda." : NO_ACCOUNT_TEXT}
                </p>
              )}

              <Link
                to="/team/$teamId/event/$eventId"
                params={{ teamId: invitation.team_id, eventId: invitation.event_id }}
                className="mt-3 inline-block text-sm text-primary underline"
              >
                Visa aktiviteten
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
