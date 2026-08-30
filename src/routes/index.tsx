import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CopyPlus, LogOut, Plus, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccount } from "@/hooks/useAccount";
import { createTactic, deleteTactic, duplicateTactic, fetchTactics, renameTactic } from "@/lib/db";
import { PITCH_SIZES } from "@/lib/tactics";
import type { PitchType } from "@/lib/tactics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Taktiktavlan – animerad fotbollstaktik" },
      {
        name: "description",
        content:
          "Bygg fotbollstaktik på mobilen: placera spelare från din spelarbank, rita löpningar och animera spelmoment steg för steg.",
      },
      { property: "og:title", content: "Taktiktavlan – animerad fotbollstaktik" },
      {
        property: "og:description",
        content: "Placera spelare, rita löpningar och animera spelmoment steg för steg.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
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
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Laddar…</div>;
  }

  if (!user) return <Landing />;
  if (account.isPlayer && !account.isCoach && !account.isAdmin) return <PlayerHome />;
  return <TacticsDashboard userId={user.id} />;
}

function TeamNav() {
  const { isAdmin, isCoach, memberships } = useAccount();
  const approved = memberships.filter((item) => item.status === "approved");
  return (
    <nav className="mt-5 flex flex-wrap gap-2">
      {isCoach && (
        <Button asChild variant="secondary" size="sm">
          <Link to="/teams">
            <Shield className="size-4" /> Mina lag
          </Link>
        </Button>
      )}
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
  );
}

function PlayerHome() {
  const queryClient = useQueryClient();
  const { memberships, profile } = useAccount();
  const approved = memberships.filter((item) => item.status === "approved");
  const pending = memberships.filter((item) => item.status === "pending");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Spelare</p>
          <h1 className="font-display text-4xl font-bold uppercase">{profile?.display_name ?? "Min profil"}</h1>
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
          <p key={item.id} className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
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
              <p className="text-xs text-muted-foreground">Trupp, kalender, träningar och matcher</p>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}


function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Taktiktavlan</p>
      <h1 className="mt-3 font-display text-5xl font-bold uppercase leading-[0.95]">
        Rita, flytta,
        <br />
        animera spelet
      </h1>
      <p className="mt-4 text-muted-foreground">
        Sätt ut dina spelare på planen, bygg upp spelmomentet steg för steg och spela upp löpningar
        och passningar som en riktig animation. Allt sparas på ditt konto.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
        <li>• Spelarbank med namn, nummer och bilder</li>
        <li>• Hel 11-mannaplan eller liten 5/7-mannaplan</li>
        <li>• Keyframes: flytta spelarna i varje steg och tryck play</li>
      </ul>
      <Button asChild size="lg" className="mt-8">
        <Link to="/auth">Kom igång</Link>
      </Button>
    </main>
  );
}

function TacticsDashboard({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pitchType, setPitchType] = useState<PitchType>("full");
  const [teamId, setTeamId] = useState<string>("");
  const { memberships } = useAccount();
  const coachTeams = memberships.filter(
    (item) => item.role === "coach" && item.status === "approved",
  );

  const tactics = useQuery({ queryKey: ["tactics"], queryFn: fetchTactics });

  const create = useMutation({
    mutationFn: () => createTactic(userId, name.trim() || "Ny taktik", pitchType, teamId || null),
    onSuccess: (id) => {
      setOpen(false);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
      navigate({ to: "/tactic/$id", params: { id } });
    },
    onError: () => toast.error("Kunde inte skapa taktiken"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTactic(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tactics"] }),
  });

  const copy = useMutation({
    mutationFn: (id: string) => duplicateTactic(userId, id),
    onSuccess: () => {
      toast.success("Taktiken kopierades");
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => renameTactic(id, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tactics"] }),
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Taktiktavlan</p>
          <h1 className="font-display text-4xl font-bold uppercase">Mina taktiker</h1>
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

      <TeamNav />

      <div className="mt-5 flex gap-2">
        <Button asChild className="flex-1">
          <Link to="/skapa">
            <Plus className="size-4" /> Ny taktik
          </Link>
        </Button>

        <Button asChild variant="secondary">
          <Link to="/bank">
            <Users className="size-4" /> Spelarbank
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/taktikbank">
            <BookOpen className="size-4" /> Taktikbank
          </Link>
        </Button>
      </div>

      <section className="mt-6 space-y-3">
        {tactics.isLoading && <p className="text-sm text-muted-foreground">Laddar taktiker…</p>}
        {tactics.data?.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Inga taktiker än. Skapa din första!
          </p>
        )}
        {tactics.data?.map((tactic) => (
          <article
            key={tactic.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <Link
              to="/tactic/$id"
              params={{ id: tactic.id }}
              className="min-w-0 flex-1"
            >
              <h2 className="truncate font-display text-xl font-semibold">{tactic.name}</h2>
              <p className="text-xs text-muted-foreground">
                {PITCH_SIZES[tactic.pitch_type]?.label ?? tactic.pitch_type} · {tactic.frameCount} steg
              </p>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Döp om"
              onClick={() => {
                const value = window.prompt("Nytt namn", tactic.name);
                if (value) rename.mutate({ id: tactic.id, value });
              }}
            >
              <span className="font-display text-sm">Aa</span>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Duplicera" onClick={() => copy.mutate(tactic.id)}>
              <CopyPlus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ta bort"
              onClick={() => {
                if (window.confirm(`Ta bort "${tactic.name}"?`)) remove.mutate(tactic.id);
              }}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </article>
        ))}
      </section>
    </main>
  );
}
