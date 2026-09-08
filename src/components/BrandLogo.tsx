import { BRAND_LOGO_ALT } from "@/lib/brand";
import logoDark from "@/assets/fotbollsrummet-logo-dark.png.asset.json";
import logoLight from "@/assets/fotbollsrummet-logo-light.png.asset.json";
import markDark from "@/assets/fotbollsrummet-mark-dark.png.asset.json";
import markLight from "@/assets/fotbollsrummet-mark-light.png.asset.json";

type Props = {
  /** Logotypens höjd i px. Sidhuvud/meny ≈ 32–40, startsida ≈ 56. */
  size?: number;
  /** Visa hela loggan med namnet. Annars bara märket. */
  showName?: boolean;
  /** Behålls för bakåtkompatibilitet – namnet ingår i bilden. */
  nameClassName?: string;
  className?: string;
};

/**
 * Varumärket Fotbollsrummet – hela loggan eller enbart hörnflaggsmärket.
 * Båda färgvarianterna finns i sidan; stilmallen visar den som passar
 * mörkt respektive ljust läge. Så slipper vi blink vid sidladdning.
 */
export function BrandLogo({ size = 40, showName = true, className }: Props) {
  const dark = showName ? logoDark.url : markDark.url;
  const light = showName ? logoLight.url : markLight.url;
  const style = { height: size, width: showName ? undefined : size };
  const base = `brand-logo shrink-0 object-contain ${showName ? "w-auto" : ""} ${className ?? ""}`;

  return (
    <>
      <img src={dark} alt={BRAND_LOGO_ALT} style={style} className={`${base} brand-logo-dark`} />
      <img src={light} alt="" aria-hidden style={style} className={`${base} brand-logo-light`} />
    </>
  );
}
