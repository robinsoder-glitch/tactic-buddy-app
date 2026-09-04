import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllClubs, fetchTeamAdminDetail } from "@/lib/admin-data";
import { fetchTeamCodes } from "@/lib/teams";
import { deleteTeam } from "@/lib/admin.functions";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/_authenticated/admin/lag/$teamId")({
  component: AdminTeamDetail,
});

const teamSchema = z.object({
  name: z.string().trim().min(1, "Lagnamn krävs.").max(80),
  age_group: z.string().trim().max(20).nullable(),
  gender: z.string().trim().min(1).max(20),
  home_ground: z.string().trim().max(120).nullable(),
  club_id: z.string().uuid().nullable(),
});

const MEMBER_ROLES = ["club_admin", "head_coach", "coach", "guardian", "player"] as const;

function AdminTeamDetail() {
  const { teamId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const removeTeam = useServerFn(deleteTeam);

  const detail = useQuery({
    queryKey: ["admin-team", teamId],
    queryFn: () => fetchTeamAdminDetail(teamId),
  });
  const clubs = useQuery({ queryKey: ["admin-clubs"], queryFn: fetchAllClubs });
  const codes = useQuery({
    queryKey: ["team-codes", teamId],
    queryFn: () => fetchTeamCodes(teamId),
  });

  const [form, setForm] = useState({
    name: "",
    age_group: "",
    gender: "mixed",
    home_ground: "",
    club_id: "",
  });

  useEffect(() => {
    const team = detail.data?.team;
    if (!team) return;
    setForm({
      name: team.name ?? "",
      age_group: team.age_group ?? "",
      gender: team.gender ?? "mixed",
      home_ground: team.home_ground ?? "",
      club_id: team.club_id ?? "",
    });
  }, [detail.data?.team]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-team", teamId] });

  const saveTeam = useMutation({
    mutationFn: async () => {
      const parsed = teamSchema.parse({
        name: form.name,
        age_group: form.age_group.trim() || null,
        gender: form.gender,
        home_ground: form.home_ground.trim() || null,
        club_id: form.club_id || null,
      });
      const { error } = await supabase.from("teams").update(parsed).eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Laget uppdaterades.");
      refresh();
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const updateMember = useMutation({
    mutationFn: async (input: { id: string; role?: string; status?: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("team_members").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medlemmen uppdaterades.");
      refresh();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medlemmen togs bort.");
      refresh();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const togglePlayer = useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("players")
        .update({ is_active: input.is_active })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (error) => toast.error(friendlyError(error)),
  });

  const removePlayer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Spelaren togs bort.");
      refresh();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const archive = useMutation({
    mutationFn: async (archived: boolean) => {
      const { error } = await supabase
        .from("teams")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const dropTeam = useMutation({
    mutationFn: () => removeTeam({ data: { teamId } }),
    onSuccess: () => {
      toast.success("Laget raderades.");
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      navigate({ to: "/admin/lag" });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  if (detail.isLoading) return <p className="text-muted-foreground">Laddar lag…</p>;
  if (detail.error) return <p className="text-destructive">{friendlyError(detail.error)}</p>;
  const team = detail.data?.team;
  if (!team) return <p className="text-muted-foreground">Laget hittades inte.</p>;

  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <section className="space-y-6">
      <Link to="/admin/lag" className="text-sm text-muted-foreground hover:underline">
        ← Alla lag
      </Link>

      <form
        className="space-y-3 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          saveTeam.mutate();
        }}
      >
        <h2 className="font-display text-2xl font-bold">Laguppgifter</h2>
        <label className="block text-sm font-semibold">
          Namn
          <input
            className={field}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Åldersgrupp
            <input
              className={field}
              value={form.age_group}
              onChange={(e) => setForm({ ...form, age_group: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Kön
            <select
              className={field}
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="mixed">Mixat</option>
              <option value="boys">Pojkar</option>
              <option value="girls">Flickor</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Hemmaplan
            <input
              className={field}
              value={form.home_ground}
              onChange={(e) => setForm({ ...form, home_ground: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Klubb
            <select
              className={field}
              value={form.club_id}
              onChange={(e) => setForm({ ...form, club_id: e.target.value })}
            >
              <option value="">Ingen klubb</option>
              {(clubs.data ?? []).map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Spelarkod <span className="font-mono">{codes.data?.join_code ?? "······"}</span> ·
          Ledarkod <span className="font-mono">{codes.data?.coach_join_code ?? "······"}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saveTeam.isPending}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            Spara
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-accent"
            onClick={() => archive.mutate(!team.archived_at)}
          >
            {team.archived_at ? "Återaktivera lag" : "Arkivera lag"}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-destructive px-4 text-sm font-semibold text-destructive hover:bg-destructive/10"
            onClick={() => {
              const answer = window.prompt(
                `Skriv lagets namn (${team.name}) för att radera det permanent.`,
              );
              if (answer?.trim() === team.name) dropTeam.mutate();
            }}
          >
            Radera lag
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-2xl font-bold">Medlemmar</h2>
        <ul className="mt-3 space-y-3">
          {(detail.data?.members ?? []).map((member) => (
            <li key={member.id} className="rounded-lg border border-border p-3">
              <p className="font-semibold">{member.displayName ?? member.user_id}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Roll för ${member.displayName ?? "medlem"}`}
                  className="min-h-11 rounded-lg border border-border bg-background px-2 text-sm"
                  value={member.role}
                  onChange={(e) => updateMember.mutate({ id: member.id, role: e.target.value })}
                >
                  {MEMBER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Status för ${member.displayName ?? "medlem"}`}
                  className="min-h-11 rounded-lg border border-border bg-background px-2 text-sm"
                  value={member.status}
                  onChange={(e) => updateMember.mutate({ id: member.id, status: e.target.value })}
                >
                  <option value="pending">Väntar</option>
                  <option value="approved">Godkänd</option>
                </select>
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-destructive px-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
                  onClick={() => removeMember.mutate(member.id)}
                >
                  Ta bort
                </button>
              </div>
            </li>
          ))}
          {(detail.data?.members ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">Inga medlemmar har anslutit.</li>
          )}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-2xl font-bold">Trupp</h2>
        <ul className="mt-3 space-y-2">
          {(detail.data?.players ?? []).map((player) => (
            <li
              key={player.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <span className="font-semibold">
                {player.number != null ? `#${player.number} ` : ""}
                {player.name}
                {!player.is_active && (
                  <span className="ml-2 text-xs text-muted-foreground">(inaktiv)</span>
                )}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-accent"
                  onClick={() =>
                    togglePlayer.mutate({ id: player.id, is_active: !player.is_active })
                  }
                >
                  {player.is_active ? "Inaktivera" : "Aktivera"}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-destructive px-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm(`Ta bort ${player.name} ur truppen?`))
                      removePlayer.mutate(player.id);
                  }}
                >
                  Ta bort
                </button>
              </span>
            </li>
          ))}
          {(detail.data?.players ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">Truppen är tom.</li>
          )}
        </ul>
      </div>

      <Link
        to="/team/$teamId"
        params={{ teamId }}
        className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
      >
        Öppna laget i vanliga vyn
      </Link>
    </section>
  );
}
