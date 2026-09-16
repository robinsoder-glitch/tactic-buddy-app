import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listAccounts, setAdminRole, deleteAccounts } from "@/lib/admin.functions";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { useAccount } from "@/hooks/useAccount";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/_authenticated/admin/konton")({
  component: AdminAccounts,
});

function AdminAccounts() {
  const { userId } = useAccount();
  const queryClient = useQueryClient();
  const load = useServerFn(listAccounts);
  const grant = useServerFn(setAdminRole);
  const remove = useServerFn(deleteAccounts);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);

  const accounts = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => load({ data: undefined }),
  });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; makeAdmin: boolean }) => grant({ data: input }),
    onSuccess: () => {
      toast.success("Behörigheten uppdaterades.");
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (userIds: string[]) => remove({ data: { userIds } }),
    onSuccess: (result) => {
      toast.success(
        result.deleted === 1 ? "Kontot raderades." : `${result.deleted} konton raderades.`,
      );
      setSelected(new Set());
      setPendingIds(null);
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = accounts.data ?? [];
    if (!term) return list;
    return list.filter((item) =>
      [item.email, item.displayName, ...item.teams.map((t) => t.teamName)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [accounts.data, query]);

  if (accounts.isLoading) return <p className="text-muted-foreground">Laddar konton…</p>;
  if (accounts.error) return <p className="text-destructive">{friendlyError(accounts.error)}</p>;

  return (
    <section className="space-y-4">
      <input
        aria-label="Sök på namn, e-post eller lag"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Sök på namn, e-post eller lag"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{rows.length} konton</p>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => setPendingIds([...selected])}
          className="min-h-11 rounded-lg border border-destructive px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40"
        >
          Radera valda konton ({selected.size})
        </button>
      </div>

      <ul className="space-y-3">
        {rows.map((account) => {
          const isAdmin = account.roles.includes("admin");
          return (
            <li key={account.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  {account.id !== userId && (
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0"
                      aria-label={`Välj ${account.email ?? account.id}`}
                      checked={selected.has(account.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(account.id)) next.delete(account.id);
                          else next.add(account.id);
                          return next;
                        })
                      }
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold">
                      {account.displayName ?? "Utan namn"}
                    </p>
                    <p className="break-all text-sm text-muted-foreground">{account.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Skapat {new Date(account.createdAt).toLocaleDateString("sv-SE")} ·{" "}
                      {account.lastSignInAt
                        ? `senast inloggad ${new Date(account.lastSignInAt).toLocaleDateString("sv-SE")}`
                        : "aldrig inloggad"}{" "}
                      · {account.confirmed ? "bekräftad" : "ej bekräftad"}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <span className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                    Admin
                  </span>
                )}
              </div>

              {account.teams.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {account.teams.map((team) => (
                    <li
                      key={`${account.id}-${team.teamId}`}
                      className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                    >
                      {team.teamName} · {team.role} · {team.status}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-accent"
                  disabled={roleMutation.isPending}
                  onClick={() => roleMutation.mutate({ userId: account.id, makeAdmin: !isAdmin })}
                >
                  {isAdmin ? "Ta bort admin" : "Gör till admin"}
                </button>
                {account.id !== userId && (
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-destructive px-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
                    disabled={deleteMutation.isPending}
                    onClick={() => setPendingIds([account.id])}
                  >
                    Radera konto
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDeleteDialog
        open={pendingIds !== null}
        onOpenChange={(open) => {
          if (!open) setPendingIds(null);
        }}
        title={
          (pendingIds?.length ?? 0) > 1 ? `Radera ${pendingIds?.length} konton?` : "Radera kontot?"
        }
        description="Inloggning och profil tas bort permanent. Lagen finns kvar."
        confirmLabel="Ja, radera"
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingIds) deleteMutation.mutate(pendingIds);
        }}
      />
    </section>
  );
}
