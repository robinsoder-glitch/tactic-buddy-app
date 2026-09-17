import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptTeamInvite,
  findTeamByCode,
  joinTeamWithCode,
  previewTeamByCode,
  previewTeamInvite,
  updateProfile,
} from "@/lib/teams";

import {
  canAcceptInvite,
  INVITE_PREVIEW_MESSAGES,
  inviteAuthSearch,
  inviteExpiryText,
  inviteRoleLabel,
  PENDING_INVITE_KEY,
  teamCodeFromToken,
} from "@/lib/invite-links";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/inbjudan/$token")({
  head: () => ({
    meta: [
      { title: "Inbjudan till lag – Fotbollsrummet" },
      {
        name: "description",
        content: "Din inbjudan till ett lag i Fotbollsrummet.",
      },
      { property: "og:title", content: "Inbjudan till lag – Fotbollsrummet" },
      { property: "og:description", content: "Gå med i laget i Fotbollsrummet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = useParams({ from: "/inbjudan/$token" });
  const teamCode = teamCodeFromToken(token);
  return teamCode ? <TeamCodeInvite token={token} code={teamCode} /> : <PersonalInvite />;
}

/** Lagets gemensamma inbjudan – en länk till alla familjer i laget. */
function TeamCodeInvite({ token, code }: { token: string; code: string }) {
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [childName, setChildName] = useState("");
  const [busy, setBusy] = useState(false);
  // Sätts när ansökan just skickats, så familjen får ett tydligt besked
  // i stället för att slussas in på en tom lagsida.
  const [sent, setSent] = useState<"pending" | "approved" | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(PENDING_INVITE_KEY, token);
    } catch {
      /* privat läge – länken fungerar ändå så länge fliken är kvar */
    }
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, [token]);

  // Lagets namn syns redan innan man loggar in – annars ser länken ut som skräppost.
  const preview = useQuery({
    queryKey: ["code-preview", code],
    queryFn: () => previewTeamByCode(code),
  });

  const team = useQuery({
    queryKey: ["team-by-code", code],
    queryFn: () => findTeamByCode(code),
    enabled: signedIn === true,
  });

  // Har kontot redan ansökt (t.ex. med koden vid registreringen) ska vi inte
  // fråga om barnets namn en gång till.
  const membership = useQuery({
    queryKey: ["invite-membership", team.data?.id],
    enabled: signedIn === true && !!team.data?.id,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || !team.data) return null;
      const { data } = await supabase
        .from("team_members")
        .select("status")
        .eq("team_id", team.data.id)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return data?.status ?? null;
    },
  });

  const teamName = preview.data?.name ?? team.data?.name ?? "Laget";
  const status = sent ?? membership.data ?? null;

  async function join() {
    if (!childName.trim()) {
      toast.error("Skriv barnets namn så tränaren vet vem du hör ihop med.");
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await updateProfile({
          id: auth.user.id,
          guardian_for_name: childName.trim(),
          account_kind: "guardian",
        });
      }
      const result = await joinTeamWithCode(code, "guardian");
      try {
        window.localStorage.removeItem(PENDING_INVITE_KEY);
      } catch {
        /* inget att rensa */
      }
      await queryClient.invalidateQueries();
      setSent(result.status);
    } catch (caught) {
      toast.error(friendlyError(caught, "Kunde inte gå med i laget"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <ShieldCheck className="mx-auto size-9 text-primary" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">Inbjudan till {teamName}</h1>

      <div className="mt-4 rounded-xl border bg-card p-4 text-left">
        <p className="text-lg font-semibold">{teamName}</p>
        {preview.data?.club_name && (
          <p className="text-sm text-muted-foreground">{preview.data.club_name}</p>
        )}
        {preview.data?.age_group && (
          <p className="text-sm text-muted-foreground">{preview.data.age_group}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {preview.data?.guardian_only === false
            ? "Spelaren eller en vårdnadshavare skapar kontot. Sedan ser ni kalender och kallelser och kan svara."
            : "Du som vårdnadshavare skapar kontot och skriver barnets namn. Sedan ser ni kalender och kallelser och kan svara."}
        </p>
      </div>

      {preview.isSuccess && !preview.data && (
        <p className="mt-4 text-sm text-destructive">
          Länken hör inte till något lag längre. Be tränaren skicka en ny länk.
        </p>
      )}

      {signedIn === false && (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            Skapa ett konto, så kopplar tränaren ditt konto till ditt barn.
          </p>
          <div className="mt-6 grid gap-2">
            <Button asChild>
              <Link to="/auth" search={inviteAuthSearch(token, "signup")}>
                Skapa konto och gå med
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/auth" search={inviteAuthSearch(token, "signin")}>
                Jag har redan ett konto
              </Link>
            </Button>
          </div>
        </>
      )}

      {signedIn && (
        <div className="mt-6 grid gap-3 text-left">
          {status ? (
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
              <p className="font-semibold">
                {status === "approved"
                  ? `Du är med i ${teamName}.`
                  : `Din ansökan är skickad till ${teamName}.`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {status === "approved"
                  ? "Du ser lagets kalender och kallelser direkt."
                  : "Tränaren godkänner dig och kopplar kontot till ditt barn. Du får en notis när det är klart – du behöver inte göra något mer."}
              </p>
              {team.data?.id && (
                <Button asChild className="mt-3">
                  <Link to="/team/$teamId" params={{ teamId: team.data.id }}>
                    Till laget
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="child-name">Barnets namn</Label>
                <Input
                  id="child-name"
                  value={childName}
                  onChange={(event) => setChildName(event.target.value)}
                  placeholder="Förnamn och efternamn"
                />
                <p className="text-xs text-muted-foreground">
                  Tränaren kopplar ditt konto till rätt spelare i truppen.
                </p>
              </div>
              <Button onClick={join} disabled={busy}>
                {busy ? "Skickar…" : "Gå med som vårdnadshavare"}
              </Button>
            </>
          )}
        </div>
      )}
    </main>
  );
}


/** Personlig engångslänk, används framför allt för nya ledare. */
function PersonalInvite() {
  const { token } = useParams({ from: "/inbjudan/$token" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [accountKind, setAccountKind] = useState<"player" | "guardian">("player");

  useEffect(() => {
    try {
      window.localStorage.setItem(PENDING_INVITE_KEY, token);
    } catch {
      /* privat läge – länken fungerar ändå så länge fliken är kvar */
    }
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, [token]);

  const preview = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => previewTeamInvite(token),
  });

  const state = preview.data?.state ?? "invalid";
  const canAccept = preview.isSuccess && canAcceptInvite(state);
  const isPlayerInvite = preview.data?.invite_role === "player";

  async function accept() {
    setBusy(true);
    try {
      const result = await acceptTeamInvite(token, isPlayerInvite ? accountKind : undefined);
      try {
        window.localStorage.removeItem(PENDING_INVITE_KEY);
      } catch {
        /* inget att rensa */
      }
      await queryClient.invalidateQueries();
      toast.success(
        result.status === "pending"
          ? "Ansökan skickad. Tränaren godkänner dig inom kort."
          : "Välkommen till laget!",
      );
      navigate({ to: "/team/$teamId", params: { teamId: result.teamId } });
    } catch (caught) {
      toast.error(friendlyError(caught, "Kunde inte använda inbjudan"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <ShieldCheck className="mx-auto size-9 text-primary" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">Inbjudan till laget</h1>

      {preview.isLoading && <p className="mt-4 text-sm text-muted-foreground">Hämtar inbjudan…</p>}

      {preview.isError && (
        <p className="mt-4 text-sm text-muted-foreground">
          Kunde inte hämta inbjudan just nu. Försök igen om en stund.
        </p>
      )}

      {preview.isSuccess && (
        <>
          {canAccept && (
            <div className="mt-4 rounded-xl border bg-card p-4 text-left">
              <p className="text-lg font-semibold">{preview.data.team_name}</p>
              {preview.data.club_name && (
                <p className="text-sm text-muted-foreground">{preview.data.club_name}</p>
              )}
              {preview.data.age_group && (
                <p className="text-sm text-muted-foreground">{preview.data.age_group}</p>
              )}
              <p className="mt-2 text-sm">Roll: {inviteRoleLabel(preview.data.invite_role)}</p>
              <p className="text-sm text-muted-foreground">
                Giltig till {inviteExpiryText(preview.data.expires_at)}
              </p>
            </div>
          )}

          <p className="mt-4 text-sm text-muted-foreground">{INVITE_PREVIEW_MESSAGES[state]}</p>

          {canAccept && signedIn === false && (
            <div className="mt-6 grid gap-2">
              <Button asChild>
                <Link to="/auth" search={inviteAuthSearch(token, "signup")}>
                  Skapa konto och gå med
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/auth" search={inviteAuthSearch(token, "signin")}>
                  Jag har redan ett konto
                </Link>
              </Button>
            </div>
          )}

          {canAccept && signedIn && (
            <div className="mt-6 grid gap-3">
              {isPlayerInvite && (
                <div className="grid gap-2 text-left">
                  <span className="text-sm font-medium">Vem är du?</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={accountKind === "player" ? "default" : "outline"}
                      onClick={() => setAccountKind("player")}
                    >
                      Spelare
                    </Button>
                    <Button
                      type="button"
                      variant={accountKind === "guardian" ? "default" : "outline"}
                      onClick={() => setAccountKind("guardian")}
                    >
                      Vårdnadshavare
                    </Button>
                  </div>
                </div>
              )}
              <Button onClick={accept} disabled={busy}>
                {busy ? "Går med…" : "Gå med i laget"}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
