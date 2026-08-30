import { useCallback, useRef, useState } from "react";
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
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
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

  const confirmDialog = (
    <AlertDialog open={state.open} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription>{state.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {state.cancelLabel ?? "Avbryt"}
          </AlertDialogCancel>
          <AlertDialogAction
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
