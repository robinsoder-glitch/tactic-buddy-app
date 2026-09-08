import { useEffect, useState } from "react";
import { BRAND_LOGO_ALT } from "@/lib/brand";
import logoDark from "@/assets/fotbollsrummet-logo-dark.png.asset.json";
import logoLight from "@/assets/fotbollsrummet-logo-light.png.asset.json";
import markDark from "@/assets/fotbollsrummet-mark-dark.png.asset.json";
import markLight from "@/assets/fotbollsrummet-mark-light.png.asset.json";

/** Sant när sidan visas i ljust läge (klassen `light` på <html>). */
function useIsLightTheme() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const read = () => setIsLight(document.documentElement.classList.contains("light"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isLight;
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
