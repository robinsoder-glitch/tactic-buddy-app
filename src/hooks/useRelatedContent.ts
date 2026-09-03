import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  buildCatalog,
  fetchContentLinks,
  relatedSections,
  type LinkType,
  type RelatedSection,
} from "@/lib/content-links";
import {
  fetchDrills,
  fetchGoalkeeperCards,
  fetchTacticCards,
  fetchTrainingSessions,
} from "@/lib/taktikbank";
import { fetchKnowledgeArticles } from "@/lib/knowledge";

/** Hämtar relationer och titlar från alla banker och bygger färdiga avsnitt. */
export function useRelatedContent(
  self: { type: LinkType; id: string } | null,
  spec: { title: string; types: LinkType[] }[],
): RelatedSection[] {
  const links = useQuery({ queryKey: ["content-links"], queryFn: fetchContentLinks });
  const articles = useQuery({ queryKey: ["knowledge-articles"], queryFn: fetchKnowledgeArticles });
  const tactics = useQuery({ queryKey: ["tb-tactics"], queryFn: fetchTacticCards });
  const drills = useQuery({ queryKey: ["tb-drills"], queryFn: fetchDrills });
  const keepers = useQuery({ queryKey: ["tb-gk"], queryFn: fetchGoalkeeperCards });
  const sessions = useQuery({ queryKey: ["tb-sessions"], queryFn: fetchTrainingSessions });

  const catalog = useMemo(
    () =>
      buildCatalog([
        ...(articles.data ?? []).map((item) => ({
          type: "article" as const,
          id: item.slug,
          title: item.title_sv,
        })),
        ...(tactics.data ?? []).map((item) => ({
          type: "tactic" as const,
          id: item.id,
          title: item.title,
        })),
        ...(drills.data ?? []).map((item) => ({
          type: "drill" as const,
          id: item.id,
          title: item.title,
        })),
        ...(keepers.data ?? []).map((item) => ({
          type: "goalkeeper" as const,
          id: item.id,
          title: item.title,
        })),
        ...(sessions.data ?? []).map((item) => ({
          type: "session" as const,
          id: item.id,
          title: item.title,
        })),
      ]),
    [articles.data, tactics.data, drills.data, keepers.data, sessions.data],
  );

  return useMemo(() => {
    if (!self) return [];
    return relatedSections(links.data ?? [], self, spec, catalog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links.data, catalog, self?.type, self?.id, JSON.stringify(spec)]);
}
