import { useId, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MailQuestion, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendContactMessage } from "@/lib/contact.functions";
import { CONTACT_MESSAGE_MAX, CONTACT_SUBJECT_MAX, contactMessageSchema } from "@/lib/contact";

interface ContactDialogProps {
  trigger: ReactNode;
}

/**
 * Kontaktformulär för inloggade användare. Avsändarens namn och e-post hämtas
 * från kontot på servern – användaren behöver bara fylla i ämne och meddelande.
 */
export function ContactDialog({ trigger }: ContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const subjectId = useId();
  const messageId = useId();
  const send = useServerFn(sendContactMessage);

  async function submit() {
    const parsed = contactMessageSchema.safeParse({ subject, message, clientId });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Kontrollera fälten och försök igen.");
      return;
    }
    setSending(true);
    try {
      await send({ data: parsed.data });
      toast.success("Ditt meddelande har skickats – vi svarar till din e-postadress.");
      setOpen(false);
      setSubject("");
      setMessage("");
      // Nytt id så nästa meddelande inte slås ihop med det som just skickades.
      setClientId(crypto.randomUUID());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skicka meddelandet. Försök igen.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailQuestion className="size-5 text-primary" aria-hidden /> Kontakta oss
          </DialogTitle>
          <DialogDescription>
            Har du en fråga eller har hittat något som inte fungerar? Skriv här så svarar vi till
            den e-postadress som är kopplad till ditt konto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={subjectId}>Ämne</Label>
            <Input
              id={subjectId}
              value={subject}
              maxLength={CONTACT_SUBJECT_MAX}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="T.ex. Fråga om kallelser"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={messageId}>Meddelande</Label>
            <Textarea
              id={messageId}
              value={message}
              maxLength={CONTACT_MESSAGE_MAX}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Beskriv din fråga så tydligt du kan…"
              rows={6}
            />
            <p className="text-right text-xs text-muted-foreground">
              {message.length}/{CONTACT_MESSAGE_MAX}
            </p>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={sending}
            onClick={() => void submit()}
          >
            <Send className="mr-2 size-4" aria-hidden />
            {sending ? "Skickar…" : "Skicka meddelande"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
