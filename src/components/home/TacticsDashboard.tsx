import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  CopyPlus,
  Download,
  Link2,
  LogOut,
  MessagesSquare,
  MoreVertical,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { useUnreadChat } from "@/hooks/useUnreadChat";
import {
  createTacticFromFrames,
  deleteTactic,
  duplicateTactic,
  fetchTactic,
  fetchTacticPreviews,
  fetchTactics,
  renameTactic,
} from "@/lib/db";
import { fetchEvents, formatDateTime } from "@/lib/teams";
import type { TeamEvent } from "@/lib/teams";
import { downloadTacticFile, parseTacticFile } from "@/lib/tactic-file";
import { pitchTypeLabel } from "@/lib/game-format";
import type { TacticSummary } from "@/lib/db";
import { TacticThumb } from "@/components/TacticThumb";
import { BrandLogo } from "@/components/BrandLogo";
import { TodayPanel } from "@/components/TodayPanel";
import { QuickCard } from "@/components/home/QuickCard";
import { useConfirm } from "@/components/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ----------------------------- dashboard ----------------------------- */

type SortKey = "updated" | "name";

export function TacticsDashboard({ userId }: { userId: string }) {
  const { confirm, confirmDialog } = useConfirm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { memberships, profile, isAdmin, isCoach } = useAccount();
  const unreadChat = useUnreadChat();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);
  const [renaming, setRenaming] = useState<TacticSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const approved = memberships.filter((item) => item.status === "approved");

  const tactics = useQuery({ queryKey: ["tactics"], queryFn: fetchTactics });
  const previews = useQuery({ queryKey: ["tactic-previews"], queryFn: fetchTacticPreviews });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTactic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
      queryClient.invalidateQueries({ queryKey: ["tactic-previews"] });
    },
  });

  const copy = useMutation({
    mutationFn: (id: string) => duplicateTactic(userId, id),
    onSuccess: () => {
      toast.success("Taktiken kopierades");
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
      queryClient.invalidateQueries({ queryKey: ["tactic-previews"] });
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => renameTactic(id, value),
    onSuccess: () => {
      setRenaming(null);
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
    },
  });

  const importFile = useMutation({
    mutationFn: async (file: File) => {
      const parsed = parseTacticFile(await file.text());
      return createTacticFromFrames(userId, parsed.name, parsed.pitchType, null, parsed.frames);
    },
    onSuccess: (id) => {
      toast.success("Taktiken importerades");
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
      navigate({ to: "/tactic/$id", params: { id } });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Kunde inte importera filen"),
  });

  const coachTeams = approved.filter((item) => item.role === "coach");
  const activeTeam = coachTeams[0] ?? approved[0] ?? null;

  const visible = useMemo(() => {
    const list = (tactics.data ?? []).filter((tactic) => {
      const matchesQuery = tactic.name.toLowerCase().includes(query.trim().toLowerCase());
      const matchesTeam = teamFilter === "all" || tactic.team_id === teamFilter;
      return matchesQuery && matchesTeam;
    });
    return [...list].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "sv")
        : b.updated_at.localeCompare(a.updated_at),
    );
  }, [tactics.data, query, sort, teamFilter]);

  const latest = tactics.data?.[0] ?? null;
  const shown = showAll ? visible : visible.slice(0, 3);

  async function exportFile(tactic: TacticSummary) {
    try {
      const detail = await fetchTactic(tactic.id);
      downloadTacticFile(detail.name, detail.pitch_type, detail.frames);
    } catch {
      toast.error("Kunde inte exportera taktiken");
    }
  }

  function copyShare(tactic: TacticSummary) {
    if (!tactic.is_public || !tactic.share_id) {
      toast.error("Slå på delning i taktiken först");
      return;
    }
    navigator.clipboard.writeText(`${window.location.origin}/t/${tactic.share_id}`).then(
      () => toast.success("Länk kopierad"),
      () => toast.error("Kunde inte kopiera"),
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <BrandLogo
            size={32}
            nameClassName="font-display text-xs font-bold uppercase tracking-[0.2em] text-primary"
          />
          <h1 className="mt-2 truncate font-display text-4xl font-bold tracking-tight">
            {profile?.display_name?.trim() ? `Hej ${profile.display_name.trim()}` : "Hej!"}
          </h1>
          {!profile?.display_name?.trim() && (
            <p className="mt-1 text-sm">
              <Link to="/installningar" className="text-primary underline underline-offset-4">
                Fyll i ditt namn i profilen
              </Link>{" "}
              så hälsar vi rätt.
            </p>
          )}

          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("sv-SE", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Logga ut"
          onClick={async () => {
            await supabase.auth.signOut();
            queryClient.clear();
          }}
        >
          <LogOut className="size-5" />
        </Button>
      </header>

      <div className="mt-5">
        <TodayPanel isCoach={isCoach} />
      </div>

      <section className="mt-3 grid gap-3 sm:grid-cols-3">
        <QuickCard
          to="/planera-traning"
          icon={<ClipboardList className="size-5" />}
          title="Planera träning"
          text="Boka träningstillfälle och fyll det med innehåll"
          primary
        />
        <QuickCard
          to="/planera-match"
          icon={<Trophy className="size-5" />}
          title="Planera match"
          text="Trupp, laguppställning och ledare"
        />
        <QuickCard
          to="/skapa"
          icon={<Plus className="size-5" />}
          title="Ny taktik"
          text="Tom taktik eller färdig mall"
        />
      </section>

      {activeTeam && (
        <Link
          to="/team/$teamId"
          params={{ teamId: activeTeam.team_id }}
          className="glass-card mt-3 flex items-center gap-4 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Shield className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Aktivt lag
            </p>
            <p className="truncate font-display text-xl font-semibold">
              {activeTeam.team?.name ?? "Laget"}
            </p>
          </div>
        </Link>
      )}

      {(isAdmin || approved.length > 0) && (
        <nav className="mt-3 flex flex-wrap gap-2">
          {isAdmin && (
            <Button asChild variant="secondary" size="sm">
              <Link to="/admin">Admin</Link>
            </Button>
          )}
          {approved.map((item) => (
            <Button asChild variant="ghost" size="sm" key={item.id}>
              <Link to="/team/$teamId" params={{ teamId: item.team_id }}>
                {item.team?.name ?? "Laget"}
              </Link>
            </Button>
          ))}
        </nav>
      )}

      {latest && (
        <section className="mt-6">
          <h2 className="font-display text-xs tracking-[0.25em] text-muted-foreground">
            Fortsätt där du var
          </h2>
          <Link
            to="/tactic/$id"
            params={{ id: latest.id }}
            className="glass-card mt-2 flex items-center gap-3 overflow-hidden rounded-2xl p-3 transition-all hover:border-primary/50"
          >
            <div className="w-28 shrink-0 overflow-hidden rounded-lg">
              <TacticThumb
                pitchType={latest.pitch_type}
                frame={previews.data?.[latest.id] ?? null}
                width={220}
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-xl font-semibold">{latest.name}</h3>
              <p className="text-xs text-muted-foreground">
                {pitchTypeLabel(latest.pitch_type)} · {latest.frameCount} steg
              </p>
            </div>
          </Link>
        </section>
      )}

      <section className="mt-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="truncate font-display text-2xl font-bold">Mina taktiker</h2>
          <div className="flex gap-2">
            <input
              ref={fileInput}
              aria-label="Importera taktikfil"
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) importFile.mutate(file);
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInput.current?.click()}
              disabled={importFile.isPending}
            >
              <Upload className="size-4" /> Importera
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            aria-label="Sök taktik"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök taktik…"
            className="min-w-40 flex-1"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSort(sort === "updated" ? "name" : "updated")}
          >
            {sort === "updated" ? "Senast ändrad" : "Namn A–Ö"}
          </Button>
        </div>

        {coachTeams.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={teamFilter === "all" ? "default" : "ghost"}
              onClick={() => setTeamFilter("all")}
            >
              Alla lag
            </Button>
            {coachTeams.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={teamFilter === item.team_id ? "default" : "ghost"}
                onClick={() => setTeamFilter(item.team_id)}
              >
                {item.team?.name ?? "Laget"}
              </Button>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {tactics.isLoading && <p className="text-sm text-muted-foreground">Laddar taktiker…</p>}

          {!tactics.isLoading && visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center sm:col-span-2">
              <p className="text-sm text-muted-foreground">
                {tactics.data?.length ? "Ingen taktik matchar sökningen." : "Inga taktiker än."}
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <Button asChild size="sm">
                  <Link to="/skapa">
                    <Plus className="size-4" /> Skapa taktik
                  </Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/taktikbank">
                    <BookOpen className="size-4" /> Välj mall
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {shown.map((tactic) => (
            <article
              key={tactic.id}
              className="glass-card group relative overflow-hidden rounded-2xl transition-all hover:-translate-y-0.5 hover:border-primary/50"
            >
              <Link
                to="/tactic/$id"
                params={{ id: tactic.id }}
                className="absolute inset-0 z-0"
                aria-label={`Öppna ${tactic.name}`}
              />
              <TacticThumb
                pitchType={tactic.pitch_type}
                frame={previews.data?.[tactic.id] ?? null}
                width={420}
              />
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-semibold">{tactic.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {pitchTypeLabel(tactic.pitch_type)} · {tactic.frameCount} steg ·{" "}
                    {new Date(tactic.updated_at).toLocaleDateString("sv-SE")}
                    {tactic.is_public ? " · delad" : ""}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Fler åtgärder"
                      className="relative z-10"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => {
                        setRenaming(tactic);
                        setRenameValue(tactic.name);
                      }}
                    >
                      <Pencil className="size-4" /> Byt namn
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => copy.mutate(tactic.id)}>
                      <CopyPlus className="size-4" /> Duplicera
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => copyShare(tactic)}>
                      <Link2 className="size-4" /> Dela – kopiera länk
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void exportFile(tactic)}>
                      <Download className="size-4" /> Exportera som fil
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        void confirm({
                          title: "Radera taktik",
                          description: `Taktiken "${tactic.name}" och alla dess steg tas bort permanent. Det går inte att ångra.`,
                        }).then((ok) => ok && remove.mutate(tactic.id));
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" /> Radera
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          ))}

          {!showAll && visible.length > shown.length && (
            <Button variant="secondary" className="sm:col-span-2" onClick={() => setShowAll(true)}>
              Visa alla {visible.length} taktiker
            </Button>
          )}
        </div>
      </section>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Byt namn</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Nytt namn på taktiken"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder="Namn på taktiken"
          />
          <DialogFooter>
            <Button
              disabled={!renameValue.trim() || rename.isPending}
              onClick={() =>
                renaming && rename.mutate({ id: renaming.id, value: renameValue.trim() })
              }
            >
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </main>
  );
}
