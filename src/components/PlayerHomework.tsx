import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Homework = {
  id: string;
  body: string;
  due_date: string | null;
  created_at: string;
};

/**
 * Läxor för en spelare. Tränaren skriver läxan, spelaren och
 * vårdnadshavaren ser den på spelarkortet.
 */
export function PlayerHomework({
  teamId,
  playerId,
  canEdit,
}: {
  teamId: string;
  playerId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const key = ["homework", playerId];

  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_homework")
        .select("id, body, due_date, created_at")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Homework[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("player_homework").insert({
        team_id: teamId,
        player_id: playerId,
        body: body.trim(),
        due_date: due || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      setDue("");
      queryClient.invalidateQueries({ queryKey: key });
      toast.success("Läxan är sparad");
    },
    onError: () => toast.error("Läxan kunde inte sparas."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("player_homework").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: () => toast.error("Läxan kunde inte tas bort."),
  });

  const items = list.data ?? [];

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <BookOpen className="size-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Läxa</h2>
      </header>

      {canEdit && (
        <div className="space-y-2">
          <Label htmlFor="homework-body">Ny läxa</Label>
          <Textarea
            id="homework-body"
            rows={3}
            maxLength={2000}
            value={body}
            placeholder="Till exempel: jonglera 20 gånger med vänsterfoten varje dag"
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="homework-due">Klar senast (valfritt)</Label>
              <Input
                id="homework-due"
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
              />
            </div>
            <Button onClick={() => add.mutate()} disabled={add.isPending || !body.trim()}>
              Ge läxan
            </Button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
          >
            <div>
              <p className="whitespace-pre-wrap text-sm">{item.body}</p>
              <p className="text-xs text-muted-foreground">
                Given {new Date(item.created_at).toLocaleDateString("sv-SE")}
                {item.due_date
                  ? ` · Klar senast ${new Date(item.due_date).toLocaleDateString("sv-SE")}`
                  : ""}
              </p>
            </div>
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Ta bort läxan"
                onClick={() => remove.mutate(item.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
        {!list.isLoading && items.length === 0 && (
          <li className="text-sm text-muted-foreground">Ingen läxa just nu.</li>
        )}
      </ul>
    </section>
  );
}
