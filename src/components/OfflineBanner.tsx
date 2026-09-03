import { CloudOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

/**
 * Visas när enheten saknar nätverk. Appen är då läsläge – inget skickas i
 * bakgrunden, så användaren vet att svar och meddelanden måste göras om senare.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-center text-xs font-medium text-amber-950"
    >
      <CloudOff className="size-4 shrink-0" aria-hidden />
      <span>
        Ingen anslutning. Du ser sparade uppgifter – svar, meddelanden och närvaro kan inte skickas
        förrän du är online igen.
      </span>
    </div>
  );
}

/** Inaktiverar knappar som kräver nätverk och förklarar varför. */
export function useOfflineGuard() {
  const online = useOnline();
  return {
    online,
    disabled: !online,
    title: online ? undefined : "Kräver internetanslutning",
  };
}
