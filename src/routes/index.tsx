import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  CopyPlus,
  GraduationCap,
  Heart,
  Trophy,
  Download,
  Link2,
  MessagesSquare,
  LogOut,
  MoreVertical,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import {
  BRAND_DESCRIPTION,
  BRAND_EYEBROW,
  BRAND_INTRO,
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_TITLE,
  brandMeta,
} from "@/lib/brand";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: brandMeta(BRAND_TITLE, BRAND_DESCRIPTION),
  }),
  component: HomePage,
});

function HomePage() {
  const { user, loading } = useAuth();
  const account = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !account.loading && account.roles.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [loading, user, account.loading, account.roles.length, navigate]);

  if (loading || (user && account.loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Laddar…
      </div>
    );
  }

  if (!user) return <Landing />;
  if (account.isPlayer && !account.isCoach && !account.isAdmin) return <PlayerHome />;
  return <TacticsDashboard userId={user.id} />;
}

function PlayerHome() {
  const queryClient = useQueryClient();
  const { memberships, profile } = useAccount();
  const approved = memberships.filter((item) => item.status === "approved");
  const pending = memberships.filter((item) => item.status === "pending");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs tracking-[0.3em] text-primary">Spelare</p>
          <h1 className="truncate font-display text-4xl font-bold">
            {profile?.display_name ?? "Min profil"}
          </h1>
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

      <section className="mt-6 space-y-3">
        {pending.map((item) => (
          <p
            key={item.id}
            className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground"
          >
            Din ansökan till {item.team?.name ?? "laget"} väntar på tränarens godkännande.
          </p>
        ))}
        {approved.length === 0 && pending.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Du är inte med i något lag än.
            <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
              <Link to="/onboarding">Gå med med lagkod</Link>
            </Button>
          </div>
        )}
        {approved.map((item) => (
          <Link
            key={item.id}
            to="/team/$teamId"
            params={{ teamId: item.team_id }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <Shield className="size-5 text-primary" />
            <div>
              <h2 className="font-display text-xl font-semibold">{item.team?.name ?? "Laget"}</h2>
              <p className="text-xs text-muted-foreground">
                Trupp, kalender, träningar och matcher
              </p>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}

const LANDING_FEATURES = [
  {
    icon: ClipboardList,
    title: "Planera träningar",
    text: "Schemalägg träningstillfällen, bygg träningspass och använd övningar från träningsbanken eller skapa egna.",
  },
  {
    icon: Trophy,
    title: "Planera matcher",
    text: "Välj spelare och en eller flera ledare, planera matchen och samla all matchinformation på samma plats.",
  },
  {
    icon: BookOpen,
    title: "Visa taktik",
    text: "Placera spelare och boll, rita löp- och passningsvägar och skapa sekvenser som kan spelas upp på taktiktavlan.",
  },
  {
    icon: Users,
    title: "Samla laget",
    text: "Hantera spelare och ledare samt håll kontakt med laget inför träningar, matcher och andra aktiviteter.",
  },
  {
    icon: GraduationCap,
    title: "Hitta övningar och kunskap",
    text: "Använd träningsbanken och kunskapsbanken för att hitta övningar, träningspass och pedagogiskt stöd.",
  },
  {
    icon: CalendarDays,
    title: "Få överblick",
    text: "Se kalender, planeringsstatus, närvaro, aktiviteter och relevant statistik för laget.",
  },
];

const PHILOSOPHY_PARAGRAPHS = [
  "Fotboll kan skapa glädje, men den kan inte ensam göra ett barn lyckligt. Däremot kan den ge barnet en plats att längta till, vänner att växa tillsammans med och modet att försöka igen efter ett misslyckande. Den kan skapa gemenskap och minnen som följer med genom livet. Därför är den viktigaste segern inte alltid att vinna matchen – utan att varje barn går hem och längtar till nästa fotbollsupplevelse.",
  "För att det ska bli möjligt krävs trygga och engagerade vuxna. Vuxna som ser varje barn, skapar gemenskap och låter glädje, lärande och utveckling gå hand i hand. Det är ett stort och viktigt uppdrag – men ingen tränare ska behöva klara det ensam.",
  "Fotbollsrummet är stödet för de vuxna runt barnens fotboll. Här finns kunskap, inspiration och praktiska verktyg som gör det enklare att planera träningar, förklara spelet och skapa meningsfulla fotbollsupplevelser för varje barn.",
  "För även om fotboll på planen självklart handlar om att försöka vinna, handlar fotbollen utanför planen om något större:",
];

function Landing() {
  const [showPhilosophy, setShowPhilosophy] = useState(false);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14 sm:py-20">
      <section className="flex flex-col items-start">
        <BrandLogo size={56} showName={false} />
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          {BRAND_EYEBROW}
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-6xl">
          {BRAND_NAME}
        </h1>
        <p className="mt-3 font-display text-xl font-semibold text-foreground sm:text-2xl">
          {BRAND_TAGLINE}
        </p>
        <p className="mt-4 max-w-2xl text-muted-foreground">{BRAND_INTRO}</p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>
              Kom igång
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Logga in</Link>
          </Button>
        </div>
      </section>

      <section className="mt-8">
        <Button
          variant="outline"
          size="lg"
          onClick={() => setShowPhilosophy(true)}
          aria-haspopup="dialog"
        >
          <Heart className="size-5 text-primary" aria-hidden />
          Vår filosofi
        </Button>
      </section>

      <Dialog open={showPhilosophy} onOpenChange={setShowPhilosophy}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-2xl">
              <Heart className="size-6 text-primary" aria-hidden />
              Vår filosofi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-foreground/90 leading-relaxed">
            {PHILOSOPHY_PARAGRAPHS.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <p className="font-display text-lg font-semibold text-primary">
              ”Så många som möjligt, så länge som möjligt, så bra som möjligt.”
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Allt du behöver för laget</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <feature.icon className="size-6 text-primary" aria-hidden />
              <h3 className="mt-3 font-display text-lg font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/* ----------------------------- dashboard ----------------------------- */

type SortKey = "updated" | "name";

function TacticsDashboard({ userId }: { userId: string }) {
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

  const nextEvent = useQuery({
    queryKey: ["next-event", approved.map((item) => item.team_id).join(",")],
    enabled: approved.length > 0,
    queryFn: async () => {
      const lists = await Promise.all(approved.map((item) => fetchEvents(item.team_id)));
      const now = Date.now();
      const upcoming = lists
        .flat()
        .filter((event) => new Date(event.starts_at).getTime() >= now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      return (upcoming[0] ?? null) as TeamEvent | null;
    },
  });

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
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <BrandLogo
            size={32}
            nameClassName="font-display text-xs font-bold uppercase tracking-[0.2em] text-primary"
          />
          <h1 className="truncate font-display text-4xl font-bold">
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

      {nextEvent.data && (
        <Link
          to="/team/$teamId"
          params={{ teamId: nextEvent.data.team_id }}
          className="mt-5 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4"
        >
          <CalendarDays className="size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-primary">
              Nästa {nextEvent.data.type === "match" ? "match" : "träning"}
            </p>
            <p className="truncate font-display text-lg font-semibold">
              {nextEvent.data.title ??
                (nextEvent.data.type === "match"
                  ? `${nextEvent.data.home_team ?? "Hemma"} – ${nextEvent.data.away_team ?? "Borta"}`
                  : "Träning")}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {formatDateTime(nextEvent.data.starts_at)}
              {nextEvent.data.location ? ` · ${nextEvent.data.location}` : ""}
            </p>
          </div>
        </Link>
      )}

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
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
          className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <Shield className="size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Aktivt lag</p>
            <p className="truncate font-display text-lg font-semibold">
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
            className="mt-2 flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3"
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
              className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/50"
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

function QuickCard({
  to,
  icon,
  title,
  text,
  primary,
  badge = 0,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  primary?: boolean;
  /** Antal olästa – visas som en röd bricka uppe till höger. */
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className={`relative flex flex-col gap-1 rounded-2xl border p-4 transition-colors ${
        primary
          ? "border-primary bg-primary/15 hover:bg-primary/25"
          : "border-border bg-card hover:border-primary/50"
      }`}
    >
      {badge > 0 && (
        <span
          aria-label={`${badge} olästa meddelanden`}
          className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold leading-none text-destructive-foreground"
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <span className="text-primary">{icon}</span>
      <span className="font-display text-lg font-semibold leading-tight">{title}</span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </Link>
  );
}
