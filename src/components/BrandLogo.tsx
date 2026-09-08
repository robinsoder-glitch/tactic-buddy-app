import { useSyncExternalStore } from "react";
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

function subscribeToTheme(onChange: () => void) {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** Sant när sidan visas i ljust läge (klassen `light` på <html>). */
function useIsLightTheme() {
  return useSyncExternalStore(
    subscribeToTheme,
    () => document.documentElement.classList.contains("light"),
    () => false,
  );
}

/**
 * Varumärket Fotbollsrummet – hela loggan eller enbart hörnflaggsmärket.
 * Bilden finns i två färgvarianter så att den ser bra ut i både mörkt
 * och ljust läge, utan färgfilter.
 */
export function BrandLogo({ size = 40, showName = true, className }: Props) {
  const isLight = useIsLightTheme();
  const src = showName
    ? (isLight ? logoLight.url : logoDark.url)
    : (isLight ? markLight.url : markDark.url);

  return (
    <img
      src={src}
      alt={BRAND_LOGO_ALT}
      style={{ height: size, width: showName ? undefined : size }}
      className={`brand-logo shrink-0 object-contain ${showName ? "w-auto" : ""} ${className ?? ""}`}
    />
  );
}
