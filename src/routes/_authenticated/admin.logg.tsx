import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLog } from "@/lib/admin-data";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/_authenticated/admin/logg")({
  component: AdminLog,
});

function AdminLog() {
  const log = useQuery({ queryKey: ["admin-audit-log"], queryFn: fetchAuditLog });

  if (log.isLoading) return <p className="text-muted-foreground">Laddar logg…</p>;
  if (log.error) return <p className="text-destructive">{friendlyError(log.error)}</p>;

  return (
    <ul className="space-y-2">
      {(log.data ?? []).map((entry) => (
        <li key={entry.id} className="rounded-xl border border-border bg-card p-3">
          <p className="text-sm font-semibold">{entry.action}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(entry.created_at).toLocaleString("sv-SE")} · {entry.target_type ?? "—"}{" "}
            {entry.target_id ?? ""}
          </p>
          {entry.details && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 text-xs">
              {JSON.stringify(entry.details, null, 2)}
            </pre>
          )}
        </li>
      ))}
      {(log.data ?? []).length === 0 && (
        <li className="text-muted-foreground">Inga händelser loggade ännu.</li>
      )}
    </ul>
  );
}
