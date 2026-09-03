import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  chatTime,
  deleteTeamChatMessage,
  fetchTeamChat,
  markChatRead,
  sendTeamChatMessage,
} from "@/lib/team-chat";
import { useTeamRole } from "@/hooks/useTeamRole";

/** Tränarsnack: intern chatt för lagets ledare. */
export function TeamChatPanel({
  teamId,
  showHeading = true,
}: {
  teamId: string;
  showHeading?: boolean;
}) {
  const { isCoach, userId, loading } = useTeamRole(teamId);
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["team-chat", teamId],
    queryFn: () => fetchTeamChat(teamId),
    enabled: !!teamId && isCoach,
    refetchInterval: 15000,
  });

  const list = messages.data ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    if (!isCoach) return;
    markChatRead(teamId);
    queryClient.invalidateQueries({ queryKey: ["team-chat-unread"] });
  }, [list.length, isCoach, teamId, queryClient]);

  const send = useMutation({
    mutationFn: () => sendTeamChatMessage(teamId, text),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["team-chat", teamId] });
    },
    onError: (error: Error) => toast.error(error.message || "Kunde inte skicka meddelandet."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTeamChatMessage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-chat", teamId] }),
    onError: () => toast.error("Kunde inte ta bort meddelandet."),
  });

  if (loading) return <p className="text-sm text-muted-foreground">Laddar …</p>;

  if (!isCoach) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 text-center">
        <MessagesSquare className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <h2 className="mt-2 font-display text-lg font-bold">Tränarsnack</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bara lagets ledare kommer åt den här chatten.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {showHeading && (
        <header>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <MessagesSquare className="size-5 text-primary" aria-hidden /> Tränarsnack
          </h2>
          <p className="text-sm text-muted-foreground">
            Intern chatt för lagets ledare – dela tips, råd och instruktioner till varandra.
          </p>
        </header>
      )}

      <div className="max-h-[55vh] space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-3">
        {messages.isLoading && (
          <p className="text-sm text-muted-foreground">Hämtar meddelanden …</p>
        )}
        {!messages.isLoading && !list.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Inga meddelanden ännu. Skriv det första!
          </p>
        )}
        {list.map((message) => {
          const mine = message.user_id === userId;
          return (
            <article
              key={message.id}
              className={`max-w-[85%] rounded-xl px-3 py-2 ${mine ? "ml-auto bg-primary/10" : "bg-secondary"}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {mine ? "Du" : (message.displayName ?? "Ledare")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {chatTime(message.created_at)}
                </span>
                {mine && (
                  <button
                    type="button"
                    aria-label="Ta bort meddelande"
                    onClick={() => remove.mutate(message.id)}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                {message.body}
              </p>
            </article>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim() || send.isPending) return;
          send.mutate();
        }}
      >
        <label className="sr-only" htmlFor="tranarsnack-text">
          Meddelande
        </label>
        <textarea
          id="tranarsnack-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (text.trim() && !send.isPending) send.mutate();
            }
          }}
          rows={2}
          placeholder="Skriv till de andra ledarna …"
          className="min-h-[3rem] flex-1 resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" aria-hidden />
          Skicka
        </button>
      </form>
    </section>
  );
}
