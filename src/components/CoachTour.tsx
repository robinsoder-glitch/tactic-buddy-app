import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type TourStep = {
  /** value of the data-tour attribute on the element to highlight */
  target?: string;
  title: string;
  body: string;
};

type Rect = { top: number; left: number; width: number; height: number };

function readRect(target?: string): Rect | null {
  if (!target || typeof document === "undefined") return null;
  const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!element) return null;
  element.scrollIntoView({ block: "center", behavior: "auto" });
  const box = element.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/** Guidad rundtur med mörkad bakgrund och bubblor som pekar på rätt knapp. */
export function CoachTour({
  steps,
  open,
  onClose,
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[index];

  useEffect(() => {
    if (!open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || !step) return;
    const update = () => setRect(readRect(step.target));
    update();
    const timer = window.setTimeout(update, 320);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step, index]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !step) return null;

  const padding = 8;
  const spotlight = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  const below = spotlight ? spotlight.top + spotlight.height + 12 : 0;
  const placeBelow = spotlight ? below < window.innerHeight - 220 : true;
  const bubbleStyle: React.CSSProperties = spotlight
    ? {
        top: placeBelow ? below : Math.max(12, spotlight.top - 12),
        left: Math.min(Math.max(12, spotlight.left), Math.max(12, window.innerWidth - 332)),
        transform: placeBelow ? undefined : "translateY(-100%)",
      }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  const last = index === steps.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" role="dialog" aria-label="Guide">
      {/* Dämpad bakgrund. Med spotlight lämnas hålet öppet så att knappen går att trycka på. */}
      {spotlight ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 bg-foreground/40"
            style={{ height: Math.max(0, spotlight.top) }}
            onClick={onClose}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-foreground/40"
            style={{ top: spotlight.top + spotlight.height }}
            onClick={onClose}
          />
          <div
            className="pointer-events-none absolute left-0 bg-foreground/40"
            style={{
              top: spotlight.top,
              height: spotlight.height,
              width: Math.max(0, spotlight.left),
            }}
            onClick={onClose}
          />
          <div
            className="pointer-events-none absolute right-0 bg-foreground/40"
            style={{
              top: spotlight.top,
              height: spotlight.height,
              left: spotlight.left + spotlight.width,
            }}
            onClick={onClose}
          />
          <div
            className="pointer-events-none absolute rounded-xl ring-2 ring-primary"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
            }}
          />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-foreground/40" onClick={onClose} />
      )}
      <div
        className="pointer-events-auto absolute w-80 max-w-[calc(100vw-24px)] animate-scale-in rounded-2xl border border-border bg-card p-4 shadow-lg"
        style={bubbleStyle}
      >
        {spotlight && (
          <div
            className={`absolute left-6 size-3 rotate-45 border-border bg-card ${
              placeBelow ? "-top-1.5 border-l border-t" : "-bottom-1.5 border-b border-r"
            }`}
          />
        )}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Steg {index + 1} av {steps.length}
        </p>
        <h2 className="mt-1 font-display text-lg font-bold">{step.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Hoppa över
          </Button>
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setIndex((i) => i - 1)}>
                Tillbaka
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? onClose() : setIndex((i) => i + 1))}>
              {last ? "Kör igång" : "Nästa"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
