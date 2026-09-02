import { BRAND_LOGO_ALT, BRAND_NAME } from "@/lib/brand";
import logoAsset from "@/assets/fotbollsrummet-logo.png.asset.json";

type Props = {
  /** Logotypens storlek i px (höjd på märket). Sidhuvud/meny ≈ 32–40, startsida ≈ 56. */
  size?: number;
  /** Visa namnet bredvid loggan. */
  showName?: boolean;
  /** Storleksklass för namnet. */
  nameClassName?: string;
  className?: string;
};

/** Varumärke: hexagon-märket, med eller utan ordbilden Fotbollsrummet. */
export function BrandLogo({ size = 40, showName = true, className }: Props) {
  if (showName) {
    return (
      <img
        src={logoAsset.url}
        alt={BRAND_LOGO_ALT}
        style={{ height: size }}
        className={`w-auto shrink-0 object-contain dark:rounded-md dark:bg-white dark:px-1.5 dark:py-0.5 ${className ?? ""}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className ?? ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${BRAND_NAME} logga`}
    >
      <img
        src={logoAsset.url}
        alt=""
        aria-hidden
        style={{ height: size, maxWidth: "none" }}
        className="w-auto object-cover object-left"
      />
    </span>
  );
}
