import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderPlus, Check } from "lucide-react";
import {
  addToCollection,
  collectionsWith,
  createCollection,
  fetchCollectionItems,
  fetchCollections,
  removeFromCollection,
} from "@/lib/collections";
import type { FavoriteKind } from "@/lib/taktikbank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = { kind: FavoriteKind; resourceId: string; title: string };

/** Spara ett kort i en egen, namngiven samling. */
export function CollectionButton({ kind, resourceId, title }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const collections = useQuery({
    queryKey: ["tb-collections"],
    queryFn: fetchCollections,
    enabled: open,
  });
  const items = useQuery({
    queryKey: ["tb-collection-items"],
    queryFn: fetchCollectionItems,
    enabled: open,
  });

  const inside = collectionsWith(items.data ?? [], kind, resourceId);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["tb-collections"] });
    void queryClient.invalidateQueries({ queryKey: ["tb-collection-items"] });
  }

  const toggle = useMutation({
    mutationFn: async (collectionId: string) => {
      if (inside.has(collectionId)) await removeFromCollection(collectionId, kind, resourceId);
      else await addToCollection(collectionId, kind, resourceId);
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const created = await createCollection(name);
      await addToCollection(created.id, kind, resourceId);
    },
    onSuccess: () => {
      setName("");
      toast.success("Samlingen är skapad.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderPlus className="size-4" /> Spara i samling
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Spara i samling</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {collections.isLoading && <p className="text-sm text-muted-foreground">Laddar…</p>}
          {!collections.isLoading && (collections.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Du har inga samlingar än. Skapa din första nedan.
            </p>
          )}
          {(collections.data ?? []).map((collection) => (
            <button
              key={collection.id}
              type="button"
              onClick={() => toggle.mutate(collection.id)}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-secondary"
            >
              <span>{collection.name}</span>
              {inside.has(collection.id) && <Check className="size-4 text-primary" />}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            create.mutate();
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ny samling, t.ex. Uppvärmning"
            aria-label="Namn på ny samling"
          />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            Skapa
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
