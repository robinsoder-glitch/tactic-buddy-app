import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarDays, Info, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  NO_ACCOUNT_TEXT,
  canRespondAsGuardian,
  canRespondSelf,
  hasMultiplePlayers,
  groupInvitationsByEvent,
  fetchMyInvitations,
  inviteStatusLabel,
  respondToInvitation,
  type InviteStatus,
  type MyInvitation,
} from "@/lib/invitations";
import { formatDateTime } from "@/lib/teams";
import { useAccount } from "@/hooks/useAccount";
import { eventDisplayTitle } from "@/lib/event-labels";
import { fetchMyGuardedPlayerIds } from "@/lib/guardians";
import { Button } from "@/components/ui/button";
import { CoachInvites } from "@/components/CoachInvites";

export const Route = createFileRoute("/_authenticated/kallelser")({
  head: () => ({
    meta: [
      { title: "Mina kallelser – svara på matcher" },
      {
        name: "description",
        content:
          "Se dina kallelser till matcher och svara om du kommer, inte kommer eller kanske kommer.",
      },
      { property: "og:title", content: "Mina kallelser" },
      { property: "og:description", content: "Svara på kallelser till lagets matcher." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyInvitesPage,
});

function MyInvitesPage() {
  const { userId, isCoach, isAdmin } = useAccount();
  const queryClient = useQueryClient();
  const [showPast, setShowPast] = useState(false);

  const invites = useQuery({
    queryKey: ["my-invitations"],
    queryFn: fetchMyInvitations,
    enabled: !isCoach && !isAdmin,
  });
  const guarded = useQuery({
    queryKey: ["guarded-players", userId],
    queryFn: () => fetchMyGuardedPlayerIds(userId),
    enabled: Boolean(userId),
  });
  const guardedIds = guarded.data ?? [];

  const respond = useMutation({
    mutationFn: ({
      invitation,
      status,
      role,
    }: {
      invitation: MyInvitation;
      status: InviteStatus;
      role: "player" | "guardian";
    }) => {
      if (!userId) throw new Error("Du måste vara inloggad.");
      return respondToInvitation({ invitation, status, userId, role });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-invitations"] }),
    onError: () => toast.error("Kunde inte spara svaret. Försök igen."),
  });

  const now = Date.now();
  // Ledare svarar aldrig på kallelser – de skickar dem i stället.
  const all = invites.data ?? [];
  // Endast kallelser som personen själv (eller som vårdnadshavare) får svara på.
  const mine = all.filter(
    (item) => canRespondSelf(item, userId) || canRespondAsGuardian(item, guardedIds),
  );
  const upcoming = mine.filter((item) => new Date(item.event.starts_at).getTime() >= now);
  const past = mine
    .filter((item) => new Date(item.event.starts_at).getTime() < now)
    .sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at));
  const list = showPast ? past : upcoming;

  if (isCoach || isAdmin) return <CoachInvites />;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8 md:pt-20">
      <h1 className="font-display text-3xl font-bold">Mina kallelser</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kallelser gäller bara matcher. Träningar svarar du inte på – där registrerar ledaren närvaro
        efteråt.
      </p>

      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant={showPast ? "ghost" : "default"}
          onClick={() => setShowPast(false)}
        >
          Kommande ({upcoming.length})
        </Button>
        <Button
          size="sm"
          variant={showPast ? "default" : "ghost"}
          onClick={() => setShowPast(true)}
        >
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
        <div className="mt-6 space-y-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <p>
            {showPast
              ? "Du har inga tidigare kallelser."
              : "Du har inga kallelser att svara på just nu."}
          </p>
          {isCoach && (
            <p className="inline-flex items-center gap-2">
              <Info className="size-4" aria-hidden /> Som ledare svarar du inte på kallelser. Du
              skickar dem under Matcher.
            </p>
          )}
          {isCoach && (
            <Link to="/planera-match" className="block text-primary underline">
              Till Matcher
            </Link>
          )}
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {groupInvitationsByEvent(list).map((group) => {
          const cancelled = Boolean(group.event.cancelled_at);
          const showNames = hasMultiplePlayers(list);
          return (
            <li key={group.eventId} className="rounded-2xl border border-border bg-card p-4">
              {cancelled && (
                <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
                  <Ban className="size-3.5" /> Inställd
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Match{group.teamName ? ` · ${group.teamName}` : ""}
              </p>
              <h2 className="font-display text-xl font-semibold">
                {eventDisplayTitle(group.event)}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-4" />
                  {formatDateTime(group.event.starts_at)}
                </span>
                {group.event.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" />
                    {group.event.location}
                  </span>
                )}
              </p>

              {group.invitations.map((invitation) => {
                const self = canRespondSelf(invitation, userId);
                const guardianOf = canRespondAsGuardian(invitation, guardedIds);
                const mayAnswer = self || guardianOf;
                return (
                  <div
                    key={invitation.id}
                    className="mt-3 border-t border-border/60 pt-3 first:border-0"
                  >
                    {showNames && (
                      <p className="text-sm font-semibold">{invitation.playerName ?? "Spelare"}</p>
                    )}
                    {invitation.message && <p className="mt-1 text-sm">{invitation.message}</p>}
                    <p className="mt-1 text-sm font-semibold">
                      Ditt svar: {inviteStatusLabel(invitation.status)}
                    </p>
                    {mayAnswer && !cancelled ? (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {(["attending", "declined", "maybe"] as InviteStatus[]).map((status) => (
                          <Button
                            key={status}
                            className="h-12"
                            variant={invitation.status === status ? "default" : "secondary"}
                            disabled={respond.isPending}
                            onClick={() =>
                              respond.mutate({
                                invitation,
                                status,
                                role: self ? "player" : "guardian",
                              })
                            }
                          >
                            {inviteStatusLabel(status)}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {cancelled ? "Matchen är inställd. Nya svar är stängda." : NO_ACCOUNT_TEXT}
                      </p>
                    )}
                  </div>
                );
              })}

              <Link
                to="/team/$teamId/event/$eventId"
                params={{ teamId: group.teamId, eventId: group.eventId }}
                className="mt-3 inline-block text-sm text-primary underline"
              >
                Visa matchen
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
