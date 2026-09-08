import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Gemensamma lägen för listor och sidor: hämtar, tomt och fel.
 * Används överallt så att appen ser likadan ut oavsett var man är.
 */

export function LoadingState({ text = "Hämtar …", className }: { text?: string; className?: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 py-4 text-sm text-muted-foreground", className)}
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      {text}
    </p>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border p-6 text-center text-sm",
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({
  text = "Det gick inte att hämta informationen just nu.",
  onRetry,
  className,
}: {
  text?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm",
        className,
      )}
    >
      <p>{text}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Försök igen
        </button>
      )}
    </div>
  );
}
