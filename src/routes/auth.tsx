import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logga in – Taktiktavlan" },
      { name: "description", content: "Logga in för att komma åt din spelarbank och dina sparade fotbollstaktiker." },
      { property: "og:title", content: "Logga in – Taktiktavlan" },
      { property: "og:description", content: "Logga in för att komma åt din spelarbank och dina sparade fotbollstaktiker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Kontot är skapat! Bekräfta din e-postadress och logga sedan in.");
          setMode("signin");
          setPassword("");
          return;
        }
        toast.success("Konto skapat! Du är inloggad.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Kunde inte logga in med Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
          {mode === "signin" ? "Logga in" : "Skapa konto"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Din spelarbank och dina taktiker sparas i molnet.
        </p>

        <Button variant="secondary" className="mt-5 w-full" onClick={handleGoogle} type="button">
          Fortsätt med Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> eller <span className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Namn</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Tränarens namn" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Lösenord</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? "Logga in" : "Skapa konto"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Har du inget konto? Registrera dig" : "Har du redan ett konto? Logga in"}
        </button>
      </div>
    </main>
  );
}
