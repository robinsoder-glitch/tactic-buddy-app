import { useEffect, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const DELETE_WORD = "RADERA";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
};

/**
 * Bekräftelseruta för alla raderingar i adminvyn.
 * Användaren måste skriva RADERA – aldrig ett namn – för att knappen ska gå att trycka på.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Radera",
  pending = false,
  onConfirm,
}: Props) {
  const [word, setWord] = useState("");

  useEffect(() => {
    if (!open) setWord("");
  }, [open]);

  const ready = word.trim().toUpperCase() === DELETE_WORD;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>{description}</div>
              <div>
                Skriv <span className="font-bold text-foreground">{DELETE_WORD}</span> för att
                bekräfta. Det går inte att ångra.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <input
          aria-label={`Skriv ${DELETE_WORD} för att bekräfta`}
          autoComplete="off"
          value={word}
          onChange={(event) => setWord(event.target.value)}
          placeholder={DELETE_WORD}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ready || pending}
            onClick={(event) => {
              if (!ready) {
                event.preventDefault();
                return;
              }
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
