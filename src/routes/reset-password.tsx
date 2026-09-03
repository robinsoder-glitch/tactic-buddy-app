import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Välj nytt lösenord – Fotbollsrummet" },
      {
        name: "description",
        content: "Skapa ett nytt lösenord till ditt konto i Fotbollsrummet.",
      },
      { property: "og:title", content: "Välj nytt lösenord – Fotbollsrummet" },
      {
        property: "og:description",
        content: "Skapa ett nytt lösenord till ditt konto i Fotbollsrummet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Länken i mejlet ger en tillfällig återställningssession.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    supabase.auth.getSession().then(({ data: current }) => {
      if (current.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Välj ett lösenord med minst 8 tecken.");
      return;
    }
    if (password !== repeat) {
      toast.error("Lösenorden är inte lika.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Lösenordet är uppdaterat.");
      navigate({ to: "/" });
    } catch (error) {
      toast.error(friendlyError(error, "Kunde inte uppdatera lösenordet"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-3">
        <BrandLogo className="size-9" />
        <h1 className="text-2xl font-bold">Välj nytt lösenord</h1>
      </div>
      {!ready ? (
        <p className="text-sm text-muted-foreground">
          Öppna länken i mejlet vi skickade, så kan du välja ett nytt lösenord här.
        </p>
      ) : (
        <form className="space-y-4 rounded-xl border bg-card p-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nytt lösenord</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repeat-password">Upprepa lösenordet</Label>
            <Input
              id="repeat-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Spara lösenordet
          </Button>
        </form>
      )}
    </main>
  );
}
