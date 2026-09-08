import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { TodayPanel } from "@/components/TodayPanel";
import { Button } from "@/components/ui/button";

export EOF
cat > /tmp/h_landing.txt <<'EOF'
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, CalendarDays, ClipboardList, GraduationCap, Heart, Trophy, Users } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BRAND_EYEBROW, BRAND_INTRO, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

function PlayerHome() {
  const queryClient = useQueryClient();
  const { memberships, profile } = useAccount();
  const approved = memberships.filter((item) => item.status === "approved");
  const pending = memberships.filter((item) => item.status === "pending");
  // Vårdnadshavare är inte spelare – rubriken ska visa rätt kontotyp.
  const isGuardian = memberships.some((item) => item.role === "guardian");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs tracking-[0.3em] text-primary">
            {isGuardian ? "Vårdnadshavare" : "Spelare"}
          </p>
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

      <div className="mt-6">
        <TodayPanel isCoach={false} />
      </div>

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
            className="glass-card flex items-center gap-3 rounded-xl p-4 transition-all hover:border-primary/50"
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
