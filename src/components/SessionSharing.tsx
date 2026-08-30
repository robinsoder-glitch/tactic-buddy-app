import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Link2Off, Users } from "lucide-react";
import { toast } from "sonner";
import {
  addResourceToEvent,
  eventOptionLabel,
  fetchSessionLinks,
  fetchUpcomingEvents,
  linkLabel,
  removeSessionLink,
} from "@/lib/event-planning";
import { updateCoachSession } from "@/lib/coach-sessions";
import { useAuth } from "@/hooks/useAuth";
import { useAccount } from "@/hooks/useAccount";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Delning med laget och koppling av träningen till aktiviteter i kalendern. */
export function SessionSharing({
  sessionId,
  title,
  teamId,
}: {
  sessionId: string;
  title: string;
  teamId: string | null;
}) {
  const { user } = useAuth();
  const account = useAccount();
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState("");

  const events = useQuery({ queryKey: ["upcoming-events"], queryFn: () => fetchUpcomingEvents() });
  const links = useQuery({ queryKey: ["session-links", sessionId], queryFn: () => fetchSessionLinks([sessionId]) });

  const coachTeams = account.memberships.filter((item) => item.role === "coach" && item.status === "approved");
  const coachTeamIds = useMemo(() => new Set(coachTeams.map((item) => item.team_id)), [coachTeams]);

  const options = useMemo(
    () => (events.data ?? []).filter((event) => coachTeamIds.has(event.team_id)),
    [events.data, coachTeamIds],
  );
  const selected = options.find((event) => event.id === eventId) ?? options[0];

  const share = useMutation({
    mutationFn: (value: string) => updateCoachSession(sessionId, { team_id: value || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      toast.success("Delningen uppdaterades");
    },
    onError: () => toast.error("Det gick inte att ändra delningen."),
  });

  const link = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Du måste vara inloggad.");
      if (!selected) throw new Error("Välj en aktivitet i kalendern först.");
      await addResourceToEvent({
        eventId: selected.id,
        teamId: selected.team_id,
        userId: user.id,
        kind: "session",
        resourceId: sessionId,
        minutes: null,
        note: null,
      });
      if (!teamId) await updateCoachSession(sessionId, { team_id: selected.team_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-links", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["coach-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["event-resources"] });
      toast.success("Träningen är kopplad till aktiviteten.");
    },
    onError: (error: Error) => toast.error(error.message || "Det gick inte att koppla träningen."),
  });

  const unlink = useMutation({
    mutationFn: (id: string) => removeSessionLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-links", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["event-resources"] });
      toast.success("Kopplingen togs bort");
    },
    onError: () => toast.error("Det gick inte att ta bort kopplingen."),
  });

  const list = links.data ?? [];

  return (
    <section className="mt-5 space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <CalendarClock className="size-5 text-primary" /> Koppla till kalendern
      </h2>
      <p className="text-sm text-muted-foreground">
        Koppla {title} till en träning eller match. Då ser lagets övriga tränare passet på aktiviteten och kan köra det
        om du inte kan vara med.
      </p>

      {list.length > 0 && (
        <ul className="space-y-2">
          {list.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span>{linkLabel(item)}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Ta bort kopplingen"
                disabled={unlink.isPending}
                onClick={() => unlink.mutate(item.id)}
              >
                <Link2Off className="size-4" /> Ta bort
              </Button>
            </li>
          ))}
        </ul>
      )}

      {events.isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar kommande aktiviteter…</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Det finns inga kommande träningar eller matcher i dina lag. Lägg först in en aktivitet i lagets kalender.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1 space-y-1">
            <Label htmlFor="session-event">Träning eller match</Label>
            <select
              id="session-event"
              className={selectClass}
              value={selected?.id ?? ""}
              onChange={(event) => setEventId(event.target.value)}
            >
              {options.map((event) => (
                <option key={event.id} value={event.id}>
                  {eventOptionLabel(event)}
                </option>
              ))}
            </select>
          </div>
          <Button disabled={link.isPending} onClick={() => link.mutate()}>
            {link.isPending ? "Kopplar…" : "Koppla träningen"}
          </Button>
        </div>
      )}

      {coachTeams.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="session-team" className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> Dela med lag
          </Label>
          <select
            id="session-team"
            className={selectClass}
            value={teamId ?? ""}
            disabled={share.isPending}
            onChange={(event) => share.mutate(event.target.value)}
          >
            <option value="">Bara jag</option>
            {coachTeams.map((item) => (
              <option key={item.team_id} value={item.team_id}>
                {item.team?.name ?? "Lag"}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Delade träningar kan läsas och köras av lagets godkända tränare. Bara du kan ändra i dem.
          </p>
        </div>
      )}
    </section>
  );
}
