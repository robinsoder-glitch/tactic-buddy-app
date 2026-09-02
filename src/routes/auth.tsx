import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleChoice } from "@/components/auth/RoleChoice";
import { AccountSetupFields } from "@/components/auth/AccountSetupFields";
import {
  applyAccountSetup,
  clearSetup,
  storeSetup,
  validateSetup,
  type AccountRole,
  type AccountSetup,
} from "@/lib/account-setup";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logga in eller skapa konto – Fotbollsrummet" },
      {
        name: "description",
        content: "Logga in som tränare eller spelare. Nya spelare går med i laget med lagkoden från tränaren.",
      },
      { property: "og:title", content: "Logga in eller skapa konto – Fotbollsrummet" },
      {
        property: "og:description",
        content: "Tränare planerar träning och match, spelare går med i laget med lagkoden.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<AccountRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<AccountSetup>({ role: "coach", name: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  function chooseRole(next: AccountRole) {
    setRole(next);
    setSetup((current) => ({ ...current, role: next }));
  }

  function patchSetup(patch: Partial<AccountSetup>) {
    setSetup((current) => ({ ...current, ...patch }));
  }

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/" });
    } catch (error) {
      toast.error(friendlyError(error, "Kunde inte logga in"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateSetup(setup, { requireCode: setup.role === "player" });
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      // Sparas lokalt: e-postbekräftelse kan göra att sessionen kommer först vid inloggning.
      storeSetup(setup);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { display_name: setup.name.trim() } },
      });
      if (error) throw error;

      if (!data.session) {
        toast.success("Kontot är skapat! Bekräfta din e-postadress och logga sedan in – vi kommer ihåg dina val.");
        setMode("signin");
        setPassword("");
        return;
      }

      const result = await applyAccountSetup(data.session.user.id, setup);
      clearSetup();
      if (result.teamName && result.status === "pending") {
        toast.success(`Ansökan skickad till ${result.teamName}. Tränaren godkänner dig inom kort.`);
      } else if (result.teamName) {
        toast.success(`Välkommen till ${result.teamName}!`);
      } else {
        toast.success("Konto skapat! Du är inloggad.");
      }
      navigate({ to: "/" });
    } catch (error) {
      toast.error(friendlyError(error, "Kunde inte skapa kontot"));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (mode === "signup" && role) storeSetup(setup);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Kunde inte logga in med Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  const showRoleStep = mode === "signup" && !role;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <p className="font-display text-xs tracking-[0.3em] text-primary">Fotbollsrummet</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">
          {mode === "signin" ? "Logga in" : showRoleStep ? "Skapa konto" : role === "coach" ? "Tränarkonto" : "Spelarkonto"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Tränare och spelare loggar in på samma sätt – du landar på rätt startsida."
            : showRoleStep
              ? "Börja med att välja vad du är. Du kan alltid byta lag senare."
              : role === "coach"
                ? "Du behöver vara minst 18 år. Har du en tränarkod går du med i laget direkt."
                : "Ange lagkoden du fått av tränaren så skickas en ansökan till laget."}
        </p>

        {showRoleStep ? (
          <div className="mt-5 space-y-4">
            <RoleChoice value={role} onChange={chooseRole} />
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode("signin")}
            >
              Har du redan ett konto? Logga in
            </button>
          </div>
        ) : (
          <>
            {mode === "signup" && (
              <button
                type="button"
                className="mt-4 flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setRole(null)}
              >
                <ArrowLeft className="size-4" aria-hidden /> Byt kontotyp
              </button>
            )}

            <Button variant="secondary" className="mt-4 w-full" onClick={handleGoogle} type="button">
              Fortsätt med Google
            </Button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> eller <span className="h-px flex-1 bg-border" />
            </div>

            <form className="space-y-4" onSubmit={mode === "signin" ? handleSignIn : handleSignUp}>
              {mode === "signup" && <AccountSetupFields setup={setup} onChange={patchSetup} />}

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
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setRole(null);
              }}
            >
              {mode === "signin" ? "Har du inget konto? Skapa ett" : "Har du redan ett konto? Logga in"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
