import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  KeyRound,
  Lock,
  LogOut,
  Palette,
  Shield,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NotificationSettingsCard } from "@/components/NotificationSettingsCard";
import { useAccount } from "@/hooks/useAccount";
import { updateProfile, TEAM_GENDER_LABELS } from "@/lib/teams";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type AppPrefs } from "@/lib/prefs";
import { DEFAULT_THEME, THEME_LABELS, loadTheme, saveTheme, type ThemeChoice } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BackLink } from "@/components/BackLink";

export const Route = createFileRoute("/_authenticated/installningar")({
  head: () => ({
    meta: [
      { title: "Inställningar – Fotbollsrummet" },
      { name: "description", content: "Profil, lag, tavlans standardval och kontoinställningar." },
      { property: "og:title", content: "Inställningar – Fotbollsrummet" },
      {
        property: "og:description",
        content: "Hantera profil, lag och standardval för taktiktavlan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, userId, profile, memberships, isCoach, isAdmin } = useAccount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [prefs, setPrefs] = useState<AppPrefs>(DEFAULT_PREFS);
  const [theme, setTheme] = useState<ThemeChoice>(DEFAULT_THEME);

  useEffect(() => setPrefs(loadPrefs()), []);
  useEffect(() => setTheme(loadTheme()), []);
  useEffect(() => {
    setName(profile?.display_name ?? "");
    setBirth(profile?.birth_date ?? "");
  }, [profile?.display_name, profile?.birth_date]);

  function patchPrefs(patch: Partial<AppPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  }

  async function saveProfile() {
    if (!userId) return;
    setSavingProfile(true);
    try {
      await updateProfile({
        id: userId,
        display_name: name.trim() || null,
        birth_date: birth || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profilen sparad");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara profilen");
    } finally {
      setSavingProfile(false);
    }
  }

  async function sendReset() {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success("Vi har mailat en länk för att byta lösenord.");
  }

  const approved = memberships.filter((item) => item.status === "approved");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <BackLink fallback="/">Tillbaka</BackLink>
      <h1 className="mt-3 font-display text-3xl font-bold">Inställningar</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {profile?.display_name?.trim() || "Namnlös profil"}
      </p>

      <section className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <UserRound className="size-4 text-primary" /> Profil
        </h2>
        <div>
          <Label htmlFor="name">Namn</Label>
          <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="birth">Födelsedatum</Label>
          <Input
            id="birth"
            type="date"
            value={birth}
            onChange={(event) => setBirth(event.target.value)}
          />
        </div>
        <Button onClick={saveProfile} disabled={savingProfile}>
          Spara profil
        </Button>
      </section>

      <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Palette className="size-4 text-primary" /> Utseende
        </h2>
        <p className="text-xs text-muted-foreground">
          Ljust läge är standard och syns bäst utomhus. Följ enheten byter automatiskt efter
          telefonens inställning.
        </p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Temaval">
          {(["light", "system", "dark"] as ThemeChoice[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                saveTheme(value);
                toast.success(`Tema: ${THEME_LABELS[value]}`);
              }}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                theme === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent"
              }`}
            >
              {THEME_LABELS[value]}
            </button>
          ))}
        </div>
      </section>

      <NotificationSettingsCard userId={userId} />

      <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <SlidersHorizontal className="size-4 text-primary" /> Taktiktavlan
        </h2>
        <PrefRow
          label="Dölj spelarnamn som standard"
          hint="Bra när hela laget ska se animationen utan att fyra namn sticker ut."
          checked={prefs.hideNames}
          onChange={(value) => patchPrefs({ hideNames: value })}
        />
        <PrefRow
          label="Rutnät och snäpp som standard"
          hint="Placerar spelare och boll på exakta positioner."
          checked={prefs.grid}
          onChange={(value) => patchPrefs({ grid: value })}
        />
        <PrefRow
          label="Visa spelarfoton på planen"
          hint="Av: symbolen visar tröjnummer eller initialer istället för bild."
          checked={prefs.showPhotos}
          onChange={(value) => patchPrefs({ showPhotos: value })}
        />
        <PrefRow
          label="Repetera animationen"
          hint="Spelar upp taktiken om och om igen tills du pausar."
          checked={prefs.loop}
          onChange={(value) => patchPrefs({ loop: value })}
        />
        <PrefRow
          label="Starta uppspelning direkt"
          hint="Animationen startar automatiskt när du öppnar en taktik."
          checked={prefs.autoplay}
          onChange={(value) => patchPrefs({ autoplay: value })}
        />
        <PrefRow
          label="Fråga innan steg tas bort"
          hint="Skyddar mot att råka radera ett steg i tidslinjen."
          checked={prefs.confirmDelete}
          onChange={(value) => patchPrefs({ confirmDelete: value })}
        />
        <div>
          <Label htmlFor="speed">Standardhastighet: {prefs.speed}x</Label>
          <input
            id="speed"
            type="range"
            min={0.25}
            max={2}
            step={0.25}
            value={prefs.speed}
            onChange={(event) => patchPrefs({ speed: Number(event.target.value) })}
            className="mt-2 w-full accent-primary"
          />
        </div>
        <div>
          <Label htmlFor="scale">
            Storlek på spelarsymboler: {Math.round(prefs.playerScale * 100)}%
          </Label>
          <input
            id="scale"
            type="range"
            min={0.7}
            max={1.6}
            step={0.1}
            value={prefs.playerScale}
            onChange={(event) => patchPrefs({ playerScale: Number(event.target.value) })}
            className="mt-2 w-full accent-primary"
          />
          <p className="text-xs text-muted-foreground">
            100 % = en spelares armspännvidd (~1,4 m) i planens skala.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="flex-1">Rutnätets finhet</Label>
          <select
            value={String(prefs.gridStep)}
            onChange={(event) => patchPrefs({ gridStep: Number(event.target.value) })}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="0.025">Fint</option>
            <option value="0.05">Normalt</option>
            <option value="0.1">Grovt</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="flex-1">Standardplan</Label>
          <select
            value={prefs.pitchType}
            onChange={(event) =>
              patchPrefs({ pitchType: event.target.value as AppPrefs["pitchType"] })
            }
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="small">Smålag (5/7)</option>
            <option value="full">Helplan (11)</option>
          </select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setPrefs(DEFAULT_PREFS);
            savePrefs(DEFAULT_PREFS);
            toast.success("Standardvärden återställda");
          }}
        >
          Återställ standardvärden
        </Button>
      </section>

      <section className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Shield className="size-4 text-primary" /> Mina lag
        </h2>
        {approvedTeams.length === 0 && (
          <p className="text-sm text-muted-foreground">Du är inte med i något lag ännu.</p>
        )}
        {approvedTeams.map((group) => (
          <Link
            key={group.team_id}
            to="/team/$teamId"
            params={{ teamId: group.team_id }}
            className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
          >
            <span className="truncate">
              {group.team?.name ?? "Lag"}
              {group.team?.gender && (
                <span className="text-muted-foreground">
                  {" "}
                  · {TEAM_GENDER_LABELS[group.team.gender]}
                </span>
              )}
            </span>
            <span className="flex shrink-0 flex-wrap justify-end gap-1">
              {membershipRoleLabels(group.roles).map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </span>
          </Link>
        ))}
        {isCoach && (
          <Link to="/teams" className="text-sm text-primary underline-offset-4 hover:underline">
            Hantera lag
          </Link>
        )}
        {isAdmin && (
          <Link
            to="/admin"
            className="block text-sm text-primary underline-offset-4 hover:underline"
          >
            Adminöversikt
          </Link>
        )}
      </section>

      <section className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Lock className="size-4 text-primary" /> Integritet
        </h2>
        <p className="text-sm text-muted-foreground">
          Vi sparar så lite som möjligt om barn. Foton är alltid frivilliga och syns bara för laget.
          Av spelarens födelsedatum använder appen bara åldersgruppen.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Bilder ligger i ett privat utrymme och nås bara av lagets medlemmar.</li>
          <li>Lagkoden ger aldrig ledarrättigheter – ledare bjuds in personligen.</li>
          <li>Delade taktiklänkar innehåller inga spelarnamn eller foton.</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Vill du att uppgifter tas bort? Radera spelaren eller laget, så försvinner även bilderna.
        </p>
      </section>

      <section className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <KeyRound className="size-4 text-primary" /> Konto
        </h2>
        <p className="text-sm text-muted-foreground">Inloggad som {user?.email}</p>
        <Button variant="secondary" onClick={sendReset}>
          Byt lösenord
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="size-4" /> Logga ut
        </Button>
      </section>
    </main>
  );
}

function PrefRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
