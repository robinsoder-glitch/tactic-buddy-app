import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { useTeamRole } from "@/hooks/useTeamRole";
import { addTeamPhoto, deleteTeamPhoto, fetchTeamPhotos } from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/team/$teamId/photos")({
  component: PhotosPage,
});

function PhotosPage() {
  const { confirm, confirmDialog } = useConfirm();
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/photos" });
  const { isCoach, userId } = useTeamRole(teamId);
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const photos = useQuery({
    queryKey: ["team-photos", teamId],
    queryFn: () => fetchTeamPhotos(teamId),
  });

  async function upload(file: File | null) {
    if (!file || !userId) return;
    setBusy(true);
    try {
      await addTeamPhoto({ teamId, userId, file, caption: caption.trim() || null });
      setCaption("");
      await queryClient.invalidateQueries({ queryKey: ["team-photos", teamId] });
      toast.success("Bilden är uppladdad");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte ladda upp bilden");
    } finally {
      setBusy(false);
    }
  }

  const remove = useMutation({
    mutationFn: (photo: { id: string; path: string }) => deleteTeamPhoto(photo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-photos", teamId] }),
  });

  return (
    <section>
      <h2 className="font-display text-2xl font-bold">Bilder</h2>

      {isCoach && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="ph-caption">Bildtext (valfritt)</Label>
            <Input
              id="ph-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="T.ex. Cupen i maj"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ph-file">
              <ImagePlus className="mr-1 inline size-4" /> Välj bild
            </Label>
            <Input
              id="ph-file"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(event) => {
                void upload(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </div>
        </div>
      )}

      {photos.data?.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Inga bilder än.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.data?.map((photo) => (
          <figure
            key={photo.id}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            {photo.url && (
              <img
                src={photo.url}
                alt={photo.caption ?? "Lagbild"}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            )}
            <figcaption className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{photo.caption ?? ""}</span>
              {isCoach && (
                <button
                  type="button"
                  aria-label="Ta bort bild"
                  onClick={() => {
                    void confirm({
                      title: "Radera bild",
                      description: "Bilden tas bort från lagets galleri permanent.",
                    }).then((ok) => ok && remove.mutate({ id: photo.id, path: photo.path }));
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </button>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
      {confirmDialog}
    </section>
  );
}
