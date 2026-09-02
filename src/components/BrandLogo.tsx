import { BRAND_LOGO_ALT, BRAND_NAME } from "@/lib/brand";

type Props = {
  /** Logotypens storlek i px. Sidhuvud/meny ≈ 32–40, startsida ≈ 56. */
  size?: number;
  /** Visa namnet bredvid loggan. */
  showName?: boolean;
  /** Storleksklass för namnet. */
  nameClassName?: string;
  className?: string;
};

/**
 * Varumärke: tillfällig platshållare (FR) plus namnet Fotbollsrummet.
 * Byt bilden här när den riktiga loggan är klar – inga andra filer behöver ändras.
 */
export function BrandLogo({ size = 40, showName = true, nameClassName, className }: Props) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <span
        role="img"
        aria-label={BRAND_LOGO_ALT}
        title="Tillfällig platshållare – logga kommer"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
        className="inline-flex shrink-0 items-center justify-center rounded-xl border border-dashed border-primary/50 bg-primary/10 font-display font-bold tracking-wide text-primary"
      >
        FR
      </span>
      {showName && (
        <span className={nameClassName ?? "font-display text-base font-bold text-foreground"}>
          {BRAND_NAME}
        </span>
      )}
    </span>
  );
}
