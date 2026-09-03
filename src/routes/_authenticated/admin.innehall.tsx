import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/_authenticated/admin/innehall")({
  component: AdminContent,
});

async function fetchContent() {
  const [tactics, sessions, events, articles] = await Promise.all([
    supabase.from("tactics").select("id, name, created_at, is_draft").order("created_at", { ascending: false }).limit(50),
    supabase.from("coach_sessions").select("id, title, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("events").select("id, title, type, starts_at").order("starts_at", { ascending: false }).limit(50),
    supabase.from("knowledge_articles").select("id, title_sv, is_published").order("updated_at", { ascending: false }).limit(50),
  ]);
  if (tactics.error) throw tactics.error;
  return {
    tactics: tactics.data ?? [],
    sessions: sessions.data ?? [],
    events: events.data ?? [],
    articles: articles.data ?? [],
  };
}

function AdminContent() {
  const queryClient = useQueryClient();
  const content = useQuery({ queryKey: ["admin-content"], queryFn: fetchContent });

  const drop = useMutation({
    mutationFn: async (input: { table: "tactics" | "coach_sessions" | "events" | "knowledge_articles"; id: string }) => {
      const { error } = await supabase.from(input.table).delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Posten togs bort.");
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  if (content.isLoading) return <p className="text-muted-foreground">Laddar innehåll…</p>;
  if (content.error) return <p className="text-destructive">{friendlyError(content.error)}</p>;

  const blocks: { title: string; table: "tactics" | "coach_sessions" | "events" | "knowledge_articles"; rows: { id: string; label: string }[] }[] = [
    {
      title: "Taktiker",
      table: "tactics",
      rows: (content.data?.tactics ?? []).map((row) => ({
        id: row.id,
        label: `${row.name}${row.is_draft ? " (utkast)" : ""}`,
      })),
    },
    {
      title: "Träningspass",
      table: "coach_sessions",
      rows: (content.data?.sessions ?? []).map((row) => ({ id: row.id, label: row.title })),
    },
    {
      title: "Aktiviteter",
      table: "events",
      rows: (content.data?.events ?? []).map((row) => ({
        id: row.id,
        label: `${row.title ?? row.type} · ${new Date(row.starts_at).toLocaleDateString("sv-SE")}`,
      })),
    },
    {
      title: "Kunskapsartiklar",
      table: "knowledge_articles",
      rows: (content.data?.articles ?? []).map((row) => ({
        id: row.id,
        label: `${row.title_sv}${row.is_published ? "" : " (opublicerad)"}`,
      })),
    },
  ];

  return (
    <section className="space-y-5">
      {blocks.map((block) => (
        <div key={block.table} className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-2xl font-bold">{block.title}</h2>
          <ul className="mt-3 space-y-2">
            {block.rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <span className="min-w-0 truncate text-sm">{row.label}</span>
                <button
                  type="button"
                  className="min-h-11 shrink-0 rounded-lg border border-destructive px-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm(`Ta bort "${row.label}" permanent?`)) drop.mutate({ table: block.table, id: row.id });
                  }}
                >
                  Ta bort
                </button>
              </li>
            ))}
            {block.rows.length === 0 && <li className="text-sm text-muted-foreground">Inget innehåll.</li>}
          </ul>
        </div>
      ))}
    </section>
  );
}
