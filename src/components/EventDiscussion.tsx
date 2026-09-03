import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DELETED_MESSAGE_TEXT,
  deleteEventMessage,
  fetchEventMessages,
  messageTime,
  sendEventMessage,
} from "@/lib/announcements";
import { useAccount } from "@/hooks/useAccount";

/** Frågor och svar som hör till en enskild aktivitet. */
export function EventDiscussion({ eventId, teamId }: { eventId: string; teamId: string }) {
  const { userId } = useAccount();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const messages = useQuery({
    queryKey: ["event-messages", eventId],
    queryFn: () => fetchEventMessages(eventId),
    enabled: !!eventId,
    refetchInterval: 20000,
  });

  const list = messages.data ?? [];

  const send = useMutation({
    mutationFn: () => sendEventMessage(eventId, teamId, text),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["event-messages", eventId] });
    },
    onError: () => toast.error("Kunde inte skicka meddelandet. Försök igen."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEventMessage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-messages", eventId] }),
    onError: () => toast.error("Kunde inte ta bort meddelandet."),
  });

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <header>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <MessageCircle className="size-5 text-primary" aria-hidden /> Frågor om aktiviteten
        </h2>
        <p className="text-sm text-muted-foreground">
          Här kan ledare, spelare och vårdnadshavare ställa frågor som gäller just den här
          aktiviteten.
        </p>
      </header>

      <div className="max-h-[45vh] space-y-3 overflow-y-auto">
        {messages.isLoading && <p className="text-sm text-muted-foreground">Hämtar frågor …</p>}
        {!messages.isLoading && !list.length && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Inga frågor ännu. Skriv den första.
          </p>
        )}
        {list.map((message) => {
          const mine = message.user_id === userId;
          return (
            <article
              key={message.id}
              className={`max-w-[90%] rounded-xl px-3 py-2 ${mine ? "ml-auto bg-primary/10" : "bg-secondary"}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold">
                  {mine ? "Du" : (message.displayName ?? "Medlem")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {messageTime(message.created_at)}
                </span>
                {mine && !message.deleted_at && (
                  <button
                    type="button"
                    aria-label="Ta bort meddelande"
                    onClick={() => remove.mutate(message.id)}
                    className="ml-auto flex size-6 items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <p
                className={`mt-1 whitespace-pre-wrap break-words text-sm ${message.deleted_at ? "italic text-muted-foreground" : "text-foreground"}`}
              >
                {message.deleted_at ? DELETED_MESSAGE_TEXT : message.body}
              </p>
            </article>
          );
        })}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim() || send.isPending) return;
          send.mutate();
        }}
      >
        <label className="sr-only" htmlFor="event-discussion-text">
          Fråga om aktiviteten
        </label>
        <textarea
          id="event-discussion-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          placeholder="Skriv en fråga …"
          className="min-h-[3rem] flex-1 resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" aria-hidden />
          Skicka
        </button>
      </form>
    </section>
  );
}
