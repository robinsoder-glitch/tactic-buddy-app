import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { claimRole, findTeamByCode, requestJoin, updateProfile } from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Välj kontotyp – Taktiktavlan" },
      { name: "description", content: "Skapa ett tränarkonto eller gå med i ett lag som spelare med lagkoden." },
      { property: "og:title", content: "Välj kontotyp – Taktiktavlan" },
      { property: "og:description", content: "Tränare eller spelare – välj hur du vill använda Taktiktavlan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

function age(birth: string) {
  const date = new Date(birth);
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) years -= 1;
  return years;
}

function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<"coach" | "player" | null>(null);
  const [birth, setBirth] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveCoach() {
    if (!user) return;
    if (!birth) return toast.error("Ange ditt födelsedatum");
    if (age(birth) < 18) return toast.error("Du måste vara minst 18 år för ett tränarkonto");
    if (!confirmed) return toast.error("Du behöver intyga att uppgiften stämmer");
    setBusy(true);
    try {
      await updateProfile({ id: user.id, birth_date: birth, is_adult_confirmed: true });
      await claimRole(user.id, "coach");
      await queryClient.invalidateQueries();
      navigate({ to: "/teams" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  async function savePlayer() {
    if (!user) return;
    if (!code.trim()) return toast.error("Ange lagkoden du fått av din tränare");
    setBusy(true);
    try {
      await claimRole(user.id, "player");
      const team = await findTeamByCode(code);
      if (!team) throw new Error("Ingen lag hittades med den koden");
      await requestJoin(team.id, user.id);
      await queryClient.invalidateQueries();
      toast.success(`Ansökan skickad till ${team.name}. Vänta på att tränaren godkänner dig.`);
      navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Kom igång</p>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase">Välj kontotyp</h1>

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={() => setChoice("coach")}
          className={`rounded-xl border p-4 text-left transition-colors ${
            choice === "coach" ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
        >
          <ClipboardList className="mb-2 size-5 text-primary" />
          <h2 className="font-display text-xl font-semibold uppercase">Tränare / lagledare</h2>
          <p className="text-sm text-muted-foreground">Skapa lag, trupp och träningar. Kräver 18 år.</p>
        </button>

        <button
          type="button"
          onClick={() => setChoice("player")}
          className={`rounded-xl border p-4 text-left transition-colors ${
            choice === "player" ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
        >
          <User className="mb-2 size-5 text-primary" />
          <h2 className="font-display text-xl font-semibold uppercase">Spelare</h2>
          <p className="text-sm text-muted-foreground">Gå med i ditt lag med lagkoden från tränaren.</p>
        </button>
      </div>

      {choice === "coach" && (
        <section className="mt-6 space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="birth">Födelsedatum</Label>
            <Input id="birth" type="date" value={birth} onChange={(event) => setBirth(event.target.value)} />
          </div>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />
            <span>Jag intygar att uppgiften stämmer och att jag är minst 18 år.</span>
          </label>
          <Button className="w-full" onClick={saveCoach} disabled={busy}>
            <ShieldCheck className="size-4" /> Skapa tränarkonto
          </Button>
        </section>
      )}

      {choice === "player" && (
        <section className="mt-6 space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Lagkod</Label>
            <Input
              id="code"
              placeholder="T.ex. A1B2C3"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">
              Koden får du av din tränare. Tränaren godkänner dig innan du kommer in i laget.
            </p>
          </div>
          <Button className="w-full" onClick={savePlayer} disabled={busy}>
            Gå med i laget
          </Button>
        </section>
      )}
    </main>
  );
}
