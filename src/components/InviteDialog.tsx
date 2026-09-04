import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EXTERNAL_CHANNELS_TEXT,
  PUBLISH_BUTTON_TEXT,
  REACH_LABELS,
  fetchGuardedPlayerIds,
  inviteStatusLabel,
  playerReach,
  publishButtonLabel,
  publishResultText,
  respondByText,
  saveInvitationPlan,
  suggestRespondBy,
  summarizeReach,
  type Invitation,
} from "@/lib/invitations";

export type InviteDialogPlayer = {
  id: string;
  name: string;
  number?: number | null;
  is_active?: boolean | null;
  member_user_id?: string | null;
};

/**
 * Dialogen för att publicera och hantera en kallelse.
 *
 * Ingen spelare är förmarkerad när en befintlig kallelse redigeras – då kan en
 * ändrad text aldrig råka kalla hela laget. Vid en helt ny kallelse föreslås
 * den preliminära matchtruppen, men publiceringen sker först efter en
 * granskningsvy där tränaren ser exakt vilka som nås och hur.
 */
export function InviteDialog({
  open,
  onOpenChange,
  eventId,
  players,
  squadPlayerIds,
  invitations,
  startsAt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  players: InviteDialogPlayer[];
  squadPlayerIds: string[];
  invitations: Invitation[];
  startsAt: string | null | undefined;
}) {
  const queryClient = useQueryClient();
  const activeInvitations = invitations.filter((item) => item.status !== "revoked");
  const hasExisting = activeInvitations.length > 0;
  // Text och svarsdag hämtas bara från en aktiv kallelse – aldrig från en
  // återkallad rad.
  const meta = activeInvitations[0];

  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [respondBy, setRespondBy] = useState("");
  const [notify, setNotify] = useState(true);
  const [search, setSearch] = useState("");
  const [review, setReview] = useState(false);

  // Nollställs varje gång dialogen öppnas. Avbryt sparar därför aldrig något.
  useEffect(() => {
    if (!open) return;
    const invitedIds = new Set(activeInvitations.map((item) => item.player_id));
    const suggestion = squadPlayerIds.filter((id) => {
      const player = players.find((p) => p.id === id);
      return player && player.is_active !== false && !invitedIds.has(id);
    });
    setSelected(hasExisting ? [] : suggestion);
    setMessage(meta?.message ?? "");
    setRespondBy(meta?.respond_by ?? suggestRespondBy(startsAt));
    setNotify(true);
    setSearch("");
    setReview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invitations, players, squadPlayerIds, startsAt]);

  const guarded = useQuery({
    queryKey: ["guarded-of-team-players", players.map((p) => p.id).join(",")],
    queryFn: () => fetchGuardedPlayerIds(players.map((p) => p.id)),
    enabled: open && players.length > 0,
  });
  const guardedIds = guarded.data ?? new Set<string>();

  // Återkallade kallelser räknas inte – spelaren kan kallas igen.
  const invitedIds = useMemo(
    () => new Set(activeInvitations.map((item) => item.player_id)),
    [activeInvitations],
  );

  const selectable = useMemo(
    () =>
      players
        .filter((player) => player.is_active !== false && !invitedIds.has(player.id))
        .filter((player) => player.name.toLowerCase().includes(search.trim().toLowerCase())),
    [players, invitedIds, search],
  );

  const reachOf = (player: InviteDialogPlayer) =>
    playerReach({
      id: player.id,
      member_user_id: player.member_user_id ?? null,
      hasActiveGuardian: guardedIds.has(player.id),
    });

  const summary = summarizeReach(
    selected.map((id) => {
      const player = players.find((p) => p.id === id);
      return {
        id,
        member_user_id: player?.member_user_id ?? null,
        hasActiveGuardian: guardedIds.has(id),
      };
    }),
  );

  const save = useMutation({
    mutationFn: () =>
      saveInvitationPlan({
        eventId,
        hasExisting,
        newPlayerIds: selected,
        message: message.trim() || null,
        respondBy: respondBy || null,
        notify: hasExisting && notify,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["invitations", eventId] });
      queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
      onOpenChange(false);
      if (result.published) {
        toast.success(
          publishResultText({
            selected: result.published.selected,
            account: result.published.reachable_account,
            guardian: result.published.reachable_guardian,
            none: result.published.unreachable,
          }),
        );
      } else {
        toast.success(
          notify
            ? "Kallelsen är uppdaterad och de kallade har fått en notis."
            : "Kallelsen är uppdaterad. Ingen notis skickades.",
        );
      }
    },
    onError: (error: Error) =>
      toast.error(error.message || "Kunde inte spara kallelsen. Försök igen."),
  });

  const nothingToDo = selected.length === 0 && !hasExisting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{hasExisting ? "Hantera kallelse" : "Skapa kallelse"}</DialogTitle>
          <DialogDescription>
            {review
              ? "Granska mottagarna innan du publicerar."
              : hasExisting
                ? "Ingen ny spelare är förvald. Bocka i de du vill lägga till."
                : "Truppen är föreslagen. Du granskar innan kallelsen publiceras."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          {review ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">{selected.length} valda spelare</p>
              <ul className="space-y-1 text-sm">
                <li>{summary.account} nås via eget konto</li>
                <li>{summary.guardian} nås via vårdnadshavare</li>
                <li>{summary.none} saknar digital mottagare</li>
              </ul>
              <ul className="space-y-1 rounded-xl border border-border p-3 text-sm">
                {selected.map((id) => {
                  const player = players.find((p) => p.id === id);
                  if (!player) return null;
                  return (
                    <li key={id} className="flex items-center justify-between gap-3">
                      <span className="truncate">{player.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {REACH_LABELS[reachOf(player)]}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                {respondByText(respondBy)}. {EXTERNAL_CHANNELS_TEXT}
              </p>
            </div>
          ) : (
            <>
              <label className="block text-sm">
                Sista svarsdag
                <Input
                  type="date"
                  value={respondBy}
                  onChange={(event) => setRespondBy(event.target.value)}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  {respondByText(respondBy)}
                </span>
              </label>

              <label className="block text-sm">
                Information till spelarna
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Till exempel samling, utrustning eller resa."
                />
              </label>

              {hasExisting && (
                <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5"
                    checked={notify}
                    onChange={(event) => setNotify(event.target.checked)}
                  />
                  <span>Vill du meddela de kallade om ändringen?</span>
                </label>
              )}

              {invitations.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold">Redan kallade</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {invitations.map((invitation) => (
                      <li
                        key={invitation.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <span className="truncate">{invitation.playerName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {inviteStatusLabel(invitation.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Lägg till mottagare</h3>
                  <span className="text-xs text-muted-foreground">{selected.length} valda</span>
                </div>
                {players.length > 8 && (
                  <Input
                    className="mt-2"
                    placeholder="Sök spelare"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                )}
                <ul className="mt-2 space-y-1">
                  {selectable.map((player) => (
                    <li key={player.id}>
                      <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                        <input
                          type="checkbox"
                          className="size-5"
                          checked={selected.includes(player.id)}
                          onChange={(event) =>
                            setSelected((prev) =>
                              event.target.checked
                                ? [...prev, player.id]
                                : prev.filter((id) => id !== player.id),
                            )
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{player.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {REACH_LABELS[reachOf(player)]}
                        </span>
                      </label>
                    </li>
                  ))}
                  {selectable.length === 0 && (
                    <li className="text-sm text-muted-foreground">
                      Alla aktiva spelare är redan kallade.
                    </li>
                  )}
                </ul>
              </section>
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-background px-6 py-4">
          <Button variant="ghost" onClick={() => (review ? setReview(false) : onOpenChange(false))}>
            {review ? "Tillbaka" : "Avbryt"}
          </Button>
          {review ? (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {PUBLISH_BUTTON_TEXT}
            </Button>
          ) : (
            <Button
              onClick={() => (selected.length > 0 ? setReview(true) : save.mutate())}
              disabled={save.isPending || nothingToDo}
            >
              {selected.length > 0 ? publishButtonLabel(selected.length) : "Spara ändringar"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
