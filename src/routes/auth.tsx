import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
  CLEARED_SETUP_METADATA,
  SETUP_ERRORS,
  applyAccountSetup,
  clearSetup,
  completePendingSetup,
  setupToMetadata,
  storeSetup,
  validateSetup,
  type AccountRole,
  type AccountSetup,
} from "@/lib/account-setup";
import type { CodeStatus } from "@/components/auth/AccountSetupFields";
import { friendlyError } from "@/lib/user-errors";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { safeNextPath } from "@/lib/invite-links";
import { authModeFromSearch, authSearchForMode } from "@/lib/auth-mode";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "signup"; next?: string } => ({
    ...(search["mode"] === "signup" ? { mode: "signup" as const } : {}),
    ...(typeof search["next"] === "string" && safeNextPath(search["next"] as string)
      ? { next: search["next"] as string }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Logga in eller skapa konto – Fotbollsrummet" },
      {
        name: "description",
        content:
          "Logga in i Fotbollsrummet. Planera träningar och matcher, samla laget och fortsätt utveckla er spelidé.",
      },
      { property: "og:title", content: "Logga in eller skapa konto – Fotbollsrummet" },
      {
        property: "og:description",
        content: "Planera träningar och matcher, samla laget och visa taktik med Fotbollsrummet.",
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
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const nextPath = safeNextPath(search.next);
  const goOn = () => navigate({ to: nextPath ?? "/" });
  const mode: Mode = authModeFromSearch(search.mode);
  const setMode = (next: Mode) => {
    void navigate({
      to: "/auth",
      search: (prev: Record<string, unknown>) =>
        authSearchForMode(
          { ...(typeof prev["next"] === "string" ? { next: prev["next"] } : {}) },
          next,
        ),
    });
  };
  const [role, setRole] = useState<AccountRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<AccountSetup>({ role: "coach", name: "" });
  const [codeStatus, setCodeStatus] = useState<CodeStatus>({
    required: false,
    ready: true,
    error: null,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: nextPath ?? "/" });
    });
  }, [navigate, nextPath]);

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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Har kontot skapats med lagkod men inte hunnit kopplas – gör klart det nu.
      let result = null;
      try {
        result = data.user ? await completePendingSetup(data.user) : null;
      } catch (setupError) {
        toast.error(friendlyError(setupError, "Kunde inte koppla dig till laget"));
      }
      await queryClient.invalidateQueries();
      if (result?.teamName && result.status === "pending") {
        toast.success(`Ansökan skickad till ${result.teamName}. Tränaren godkänner dig inom kort.`);
      }
      goOn();
    } catch (error) {
      toast.error(friendlyError(error, "Kunde inte logga in"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateSetup(setup, { requireCode: codeStatus.required });
    if (problem) {
      toast.error(problem);
      return;
    }
    if (codeStatus.required && !codeStatus.ready) {
      toast.error(codeStatus.error ?? SETUP_ERRORS.codeInvalid);
      return;
    }
    if (password.length < 6) {
      toast.error(SETUP_ERRORS.weakPassword);
      return;
    }
    setBusy(true);
    try {
      // Sparas lokalt: e-postbekräftelse kan göra att sessionen kommer först vid inloggning.
      storeSetup(setup);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          // Hela registreringsunderlaget följer med kontot – fungerar även om
          // bekräftelselänken öppnas på en annan telefon eller dator.
          data: setupToMetadata(setup),
        },
      });
      if (error) throw error;

      // Supabase svarar 200 även när e-posten redan finns – då är identities tom.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        toast.error(SETUP_ERRORS.emailTaken);
        setMode("signin");
        setPassword("");
        return;
      }

      if (!data.session) {
        toast.success(
          "Kontot är skapat! Bekräfta din e-postadress och logga sedan in – vi kommer ihåg dina val.",
        );
        setMode("signin");
        setPassword("");
        return;
      }

      const result = await applyAccountSetup(data.session.user.id, setup);
      clearSetup();
      // Registreringsunderlaget är förbrukat – rensa det så att nästa inloggning inte gör om det.
      await supabase.auth.updateUser({
        data: { ...CLEARED_SETUP_METADATA, display_name: setup.name.trim() },
      });
      // Roller och medlemskap hämtades innan kontot fanns – hämta om dem.
      await queryClient.invalidateQueries();
      if (result.teamName && result.status === "pending") {
        toast.success(`Ansökan skickad till ${result.teamName}. Tränaren godkänner dig inom kort.`);
      } else if (result.teamName) {
        toast.success(`Välkommen till ${result.teamName}!`);
      } else {
        toast.success("Konto skapat! Du är inloggad.");
      }
      goOn();
    } catch (error) {
      toast.error(friendlyError(error, "Kunde inte skapa kontot"));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error("Fyll i din e-postadress först, så skickar vi en återställningslänk.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Vi har skickat en länk för att välja nytt lösenord. Kolla din e-post.");
    } catch (error) {
      toast.error(friendlyError(error, "Kunde inte skicka återställningslänken"));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (mode === "signup" && role) storeSetup(setup);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Kunde inte logga in med Google");
      return;
    }
    if (result.redirected) return;
    goOn();
  }

  const showRoleStep = mode === "signup" && !role;

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl items-center gap-10 px-4 py-10 lg:grid-cols-[1fr_minmax(0,26rem)]">
      <section className="order-2 lg:order-1">
        <BrandLogo size={56} showName={false} />
        <h2 className="mt-5 font-display text-3xl font-bold sm:text-4xl">{BRAND_NAME}</h2>
        <p className="mt-2 font-display text-xl font-semibold">Välkommen tillbaka</p>
        <p className="mt-3 max-w-md text-muted-foreground">
          Planera träningar och matcher, samla laget och fortsätt utveckla er spelidé.
        </p>
      </section>
      <div className="order-1 w-full rounded-2xl border border-border bg-card p-6 shadow-xl lg:order-2">
        {mode === "signup" && (
          <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden />
              Tillbaka
            </Link>
          </Button>
        )}
        <BrandLogo
          size={32}
          nameClassName="font-display text-xs font-bold uppercase tracking-[0.2em] text-primary"
          className="lg:hidden"
        />
        <h1 className="mt-3 font-display text-3xl font-bold tracking-wide">
          {mode === "signin"
            ? "Logga in"
            : showRoleStep
              ? "Skapa konto"
              : role === "coach"
                ? "Tränarkonto"
                : "Spelarkonto"}
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

            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={handleGoogle}
              type="button"
            >
              Fortsätt med Google
            </Button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> eller{" "}
              <span className="h-px flex-1 bg-border" />
            </div>

            <form className="space-y-4" onSubmit={mode === "signin" ? handleSignIn : handleSignUp}>
              {mode === "signup" && (
                <AccountSetupFields
                  setup={setup}
                  onChange={patchSetup}
                  onCodeStatus={setCodeStatus}
                />
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
              <Button
                type="submit"
                className="w-full"
                disabled={busy || (mode === "signup" && codeStatus.required && !codeStatus.ready)}
              >
                {mode === "signin" ? "Logga in" : "Skapa konto"}
              </Button>
            </form>

            {mode === "signin" && (
              <button
                type="button"
                className="mt-3 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={handleForgotPassword}
                disabled={busy}
              >
                Glömt lösenordet?
              </button>
            )}

            <button
              type="button"
              className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setRole(null);
              }}
            >
              {mode === "signin"
                ? "Har du inget konto? Skapa ett"
                : "Har du redan ett konto? Logga in"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
