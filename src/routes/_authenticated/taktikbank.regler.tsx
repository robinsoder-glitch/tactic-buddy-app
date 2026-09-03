import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { fetchDistrictProfiles, fetchRulesets } from "@/lib/taktikbank";
import { RulesView } from "@/components/rules/RulesView";
import { useAccount } from "@/hooks/useAccount";
import { BackIconButton } from "@/components/BackLink";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/taktikbank/regler")({
  head: () => ({
    meta: [
      { title: "Regler och spelformer – Taktikbank" },
      {
        name: "description",
        content:
          "Regelverk för 5 mot 5 och 7 mot 7 presenterat på vanlig svenska, med källor och granskning.",
      },
      { property: "og:title", content: "Regler och spelformer" },
      {
        property: "og:description",
        content: "Regelverk för barnfotboll med källor och granskningsstatus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReglerPage,
});

function ReglerPage() {
  const { isCoach, isAdmin, loading } = useAccount();
  const allowed = isCoach || isAdmin;

  const rulesets = useQuery({ queryKey: ["tb-rules"], queryFn: fetchRulesets, enabled: allowed });
  const districts = useQuery({
    queryKey: ["tb-districts"],
    queryFn: fetchDistrictProfiles,
    enabled: allowed,
  });

  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center text-muted-foreground">Laddar…</main>
    );
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Regler</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sidan är till för tränare och lagledare.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <header className="flex items-center gap-2">
        <BackIconButton fallback="/taktikbank" label="Tillbaka" />
        <h1 className="font-display text-3xl font-bold">Regler</h1>
      </header>
      <section className="mt-4">
        {(rulesets.isLoading || districts.isLoading) && (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        )}
        {!rulesets.isLoading && !districts.isLoading && (
          <RulesView
            rulesets={rulesets.data ?? []}
            districts={districts.data ?? []}
            isAdmin={isAdmin}
          />
        )}
      </section>
    </main>
  );
}
