import { BRAND_LOGO_ALT } from "@/lib/brand";
import logoAsset from "@/assets/fotbollsrummet-logo.png.asset.json";
import markAsset from "@/assets/fotbollsrummet-mark.png.asset.json";

type Props = {
  /** Logotypens höjd i px. Sidhuvud/meny ≈ 32–40, startsida ≈ 56. */
  size?: number;
  /** Visa hela loggan med namnet. Annars bara märket. */
  showName?: boolean;
  /** Behålls för bakåtkompatibilitet – namnet ingår i bilden. */
  nameClassName?: string;
  className?: string;
};

/** Varumärket Fotbollsrummet – hela loggan eller enbart hörnflaggsmärket. */
export function BrandLogo({ size = 40, showName = true, className }: Props) {
  const src = showName ? logoAsset.url : markAsset.url;
  return (
    <img
      src={src}
      alt={BRAND_LOGO_ALT}
      style={{ height: size, width: showName ? undefined : size }}
      className={`brand-logo shrink-0 object-contain ${showName ? "w-auto" : ""} ${className ?? ""}`}
    />
  );
}
