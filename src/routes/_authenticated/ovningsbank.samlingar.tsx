import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FolderOpen, Trash2 } from "lucide-react";
import {
  countByCollection,
  createCollection,
  deleteCollection,
  fetchCollectionItems,
  fetchCollections,
  removeFromCollection,
  renameCollection,
} from "@/lib/collections";
import { fetchDrills, fetchTacticCards, fetchTrainingSessions } from "@/lib/taktikbank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoachOnly } from "@/components/CoachOnly";
import { useConfirm } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/ovningsbank/samlingar")({
  head: () => ({
    meta: [
      { title: "Mina samlingar – Träningsbanken" },
      {
        name: "description",
        content:
          "Samla övningar och taktikkort i egna, namngivna samlingar och hitta tillbaka till dem snabbt.",
      },
      { property: "og:title", content: "Mina samlingar" },
      { property: "og:description", content: "Egna samlingar med övningar och taktikkort." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CoachOnly>
      <CollectionsPage />
    </CoachOnly>
  ),
});

function CollectionsPage() {
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const collections = useQuery({ queryKey: ["tb-collections"], queryFn: fetchCollections });
  const items = useQuery({ queryKey: ["tb-collection-items"], queryFn: fetchCollectionItems });
  const drills = useQuery({ queryKey: ["tb-drills"], queryFn: fetchDrills });
  const tactics = useQuery({ queryKey: ["tb-tactics"], queryFn: fetchTacticCards });
  const sessions = useQuery({ queryKey: ["tb-sessions"], queryFn: fetchTrainingSessions });

  const counts = countByCollection(items.data ?? []);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["tb-collections"] });
    void queryClient.invalidateQueries({ queryKey: ["tb-collection-items"] });
  }

  const create = useMutation({
    mutationFn: () => createCollection(name),
    onSuccess: () => {
      setName("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rename = useMutation({
    mutationFn: (input: { id: string; name: string }) => renameCollection(input.id, input.name),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const removeItem = useMutation({
    mutationFn: (input: { collectionId: string; kind: never; resourceId: string }) =>
      removeFromCollection(input.collectionId, input.kind, input.resourceId),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  function titleFor(kind: string, id: string): string {
    if (kind === "drill") return drills.data?.find((d) => d.id === id)?.title ?? "Övning";
    if (kind === "tactic") return tactics.data?.find((t) => t.id === id)?.title ?? "Taktikkort";
    if (kind === "session") return sessions.data?.find((s) => s.id === id)?.title ?? "Träningspass";
    return id;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      {confirmDialog}
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka till träningsbanken">
          <Link to="/ovningsbank">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-bold">Mina samlingar</h1>
      </header>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ny samling, t.ex. Passningsövningar"
          aria-label="Namn på ny samling"
        />
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          Skapa
        </Button>
      </form>

      {collections.isLoading && <p className="mt-6 text-sm text-muted-foreground">Laddar…</p>}

      {!collections.isLoading && (collections.data ?? []).length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
          <FolderOpen className="mx-auto size-8 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Du har inga samlingar än. Skapa en ovanför, och lägg sedan till övningar från
            träningsbanken med "Spara i samling".
          </p>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {(collections.data ?? []).map((collection) => {
          const rows = (items.data ?? []).filter((item) => item.collection_id === collection.id);
          return (
            <section key={collection.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {editing?.id === collection.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      rename.mutate({ id: collection.id, name: editing.name });
                    }}
                  >
                    <Input
                      value={editing.name}
                      onChange={(event) => setEditing({ id: collection.id, name: event.target.value })}
                      aria-label="Nytt namn på samlingen"
                    />
                    <Button type="submit" size="sm">
                      Spara
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Avbryt
                    </Button>
                  </form>
                ) : (
                  <>
                    <div>
                      <h2 className="font-display text-lg font-bold">{collection.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {counts.get(collection.id) ?? 0} sparade kort
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing({ id: collection.id, name: collection.name })}
                      >
                        Byt namn
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Ta bort samlingen ${collection.name}`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Ta bort samlingen?",
                            description:
                              "Samlingen försvinner, men övningarna och korten finns kvar i banken.",
                          });
                          if (ok) remove.mutate(collection.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Inget sparat här än.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {rows.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      {item.kind === "drill" ? (
                        <Link
                          to="/ovningsbank/$drillId"
                          params={{ drillId: item.resource_id }}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {titleFor(item.kind, item.resource_id)}
                        </Link>
                      ) : (
                        <span>{titleFor(item.kind, item.resource_id)}</span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Ta bort ur samlingen"
                        onClick={() =>
                          removeItem.mutate({
                            collectionId: collection.id,
                            kind: item.kind as never,
                            resourceId: item.resource_id,
                          })
                        }
                      >
                        Ta bort
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
