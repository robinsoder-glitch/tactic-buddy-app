import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lyssnar på ändringar i en tabell och uppdaterar en hämtning direkt när
 * något händer. Används i stället för att fråga servern med jämna mellanrum.
 * Pollning kan finnas kvar som reserv om direktkanalen inte är tillgänglig.
 */
export function useRealtimeRefetch(options: {
  table: string;
  filter?: string;
  queryKey: QueryKey;
  enabled?: boolean;
  alsoInvalidate?: QueryKey[];
}) {
  const { table, filter, queryKey, enabled = true, alsoInvalidate } = options;
  const queryClient = useQueryClient();
  const key = JSON.stringify(queryKey);
  const extra = JSON.stringify(alsoInvalidate ?? []);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`rt:${table}:${filter ?? "all"}:${key}`)
      .on(
        "postgres_changes",
        filter
          ? { event: "*", schema: "public", table, filter }
          : { event: "*", schema: "public", table },
        () => {
          void queryClient.invalidateQueries({ queryKey: JSON.parse(key) as QueryKey });
          for (const item of JSON.parse(extra) as QueryKey[]) {
            void queryClient.invalidateQueries({ queryKey: item });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter, key, extra, enabled, queryClient]);
}
