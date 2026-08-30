import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  LINK_TYPES,
  LINK_TYPE_LABELS,
  createContentLink,
  deleteContentLink,
  fetchContentLinks,
  isDuplicateLink,
  type CatalogEntry,
  type LinkType,
} from "@/lib/content-links";
import { fetchKnowledgeArticles } from "@/lib/knowledge";
import { fetchDrills, fetchGoalkeeperCards, fetchTacticCards, fetchTrainingSessions } from "@/lib/taktikbank";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Adminverktyg för att koppla ihop artiklar, taktikkort, övningar och pass. */
export function ContentLinkAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const links = useQuery({ queryKey: ["content-links"], queryFn: fetchContentLinks });
  const articles = useQuery({ queryKey: ["knowledge-articles"], queryFn: fetchKnowledgeArticles });
  const tactics = useQuery({ queryKey: ["tb-tactics"], queryFn: fetchTacticCards });
  const drills = useQuery({ queryKey: ["tb-drills"], queryFn: fetchDrills });
  const keepers = useQuery({ queryKey: ["tb-gk"], queryFn: fetchGoalkeeperCards });
  const sessions = useQuery({ queryKey: ["tb-sessions"], queryFn: fetchTrainingSessions });

  const entries = useMemo<CatalogEntry[]>(
    () => [
      ...(articles.data ?? []).map((item) => ({ type: "article" as const, id: item.slug, title: item.title_sv })),
      ...(tactics.data ?? []).map((item) => ({ type: "tactic" as const, id: item.id, title: item.title })),
      ...(drills.data ?? []).map((item) => ({ type: "drill" as const, id: item.id, title: item.title })),
      ...(keepers.data ?? []).map((item) => ({ type: "goalkeeper" as const, id: item.id, title: item.title })),
      ...(sessions.data ?? []).map((item) => ({ type: "session" as const, id: item.id, title: item.title })),
    ],
    [articles.data, tactics.data, drills.data, keepers.data, sessions.data],
  );
  const titleOf = (type: LinkType, id: string) =>
    entries.find((entry) => entry.type === type && entry.id === id)?.title ?? id;

  const [sourceType, setSourceType] = useState<LinkType>("article");
  const [sourceId, setSourceId] = useState("");
  const [targetType, setTargetType] = useState<LinkType>("drill");
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Inte inloggad");
      if (!sourceId || !targetId) throw new Error("Välj både källa och mål.");
      if (sourceType === targetType && sourceId === targetId) throw new Error("Kan inte koppla till sig själv.");
      const candidate = { source_type: sourceType, source_id: sourceId, target_type: targetType, target_id: targetId, note };
      if (isDuplicateLink(links.data ?? [], candidate)) throw new Error("Relationen finns redan.");
      await createContentLink(candidate, user.id);
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["content-links"] });
      toast.success("Relationen sparades");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteContentLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-links"] });
      toast.success("Relationen togs bort");
    },
    onError: () => toast.error("Det gick inte att ta bort relationen."),
  });

  const options = (type: LinkType) => entries.filter((entry) => entry.type === type);

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4" aria-label="Kopplat innehåll">
      <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground">Kopplat innehåll</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Koppla en artikel, ett taktikkort eller en övning till annat innehåll. Kopplingen visas åt båda hållen.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="link-source-type">Från</Label>
          <select
            id="link-source-type"
            className={selectClass}
            value={sourceType}
            onChange={(event) => {
              setSourceType(event.target.value as LinkType);
              setSourceId("");
            }}
          >
            {LINK_TYPES.map((type) => (
              <option key={type} value={type}>
                {LINK_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            aria-label="Välj innehåll att koppla från"
            className={selectClass}
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
          >
            <option value="">Välj…</option>
            {options(sourceType).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="link-target-type">Till</Label>
          <select
            id="link-target-type"
            className={selectClass}
            value={targetType}
            onChange={(event) => {
              setTargetType(event.target.value as LinkType);
              setTargetId("");
            }}
          >
            {LINK_TYPES.map((type) => (
              <option key={type} value={type}>
                {LINK_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            aria-label="Välj innehåll att koppla till"
            className={selectClass}
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            <option value="">Välj…</option>
            {options(targetType).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <Label htmlFor="link-note">Kort anteckning (valfritt)</Label>
        <Input
          id="link-note"
          value={note}
          placeholder="T.ex. Träna detta först"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <Button className="mt-3" disabled={create.isPending} onClick={() => create.mutate()}>
        {create.isPending ? "Sparar…" : "Spara relation"}
      </Button>

      <ul className="mt-4 space-y-2">
        {(links.data ?? []).map((link) => (
          <li key={link.id} className="flex items-start gap-2 rounded-lg border border-border p-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate">
                {titleOf(link.source_type, link.source_id)} → {titleOf(link.target_type, link.target_id)}
              </p>
              <p className="text-xs text-muted-foreground">
                {LINK_TYPE_LABELS[link.source_type]} → {LINK_TYPE_LABELS[link.target_type]}
                {link.note ? ` · ${link.note}` : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ta bort relationen"
              onClick={() => remove.mutate(link.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {!links.isLoading && (links.data ?? []).length === 0 && (
          <li className="text-xs text-muted-foreground">Inga relationer ännu.</li>
        )}
      </ul>
    </section>
  );
}
