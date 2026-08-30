import { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
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

export type ConfirmOptions = {
  /** Kort rubrik, t.ex. "Ta bort taktik" */
  title: string;
  /** Exakt vad som tas bort och konsekvensen */
  description: string;
  /** Text på den röda knappen */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ej destruktiv bekräftelse (t.ex. slå på delning) – knappen blir inte röd */
  tone?: "destructive" | "default";
  /** Stark bekräftelse: användaren måste skriva exakt denna text för att kunna fortsätta */
  requireText?: string;
};

type State = ConfirmOptions & { open: boolean };

const initial: State = { open: false, title: "", description: "" };

/**
 * Bekräftelsedialog på svenska för destruktiva åtgärder.
 * Använd: const { confirm, confirmDialog } = useConfirm();
 * if (await confirm({ title, description })) doDelete();
 */
export function useConfirm() {
  const [state, setState] = useState<State>(initial);
  const [typed, setTyped] = useState("");
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setTyped("");
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }

  const destructive = state.tone !== "default";
  const blocked = Boolean(state.requireText) && typed.trim() !== state.requireText;

  const confirmDialog = (
    <AlertDialog open={state.open} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription>{state.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {state.requireText && (
          <div className="space-y-1.5">
            <label htmlFor="confirm-text" className="text-sm text-muted-foreground">
              Skriv <span className="font-semibold text-foreground">{state.requireText}</span> för att bekräfta
            </label>
            <Input id="confirm-text" value={typed} onChange={(event) => setTyped(event.target.value)} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {state.cancelLabel ?? "Avbryt"}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={blocked}
            onClick={() => settle(true)}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {state.confirmLabel ?? (destructive ? "Radera" : "Fortsätt")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, confirmDialog };
}
