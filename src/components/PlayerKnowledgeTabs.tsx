import { Link } from "@tanstack/react-router";

const base =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors";

/** Spelarnas egen kunskapsdel – helt skild från ledarnas kunskapsbank. */
export function PlayerKnowledgeTabs({
  active,
}: {
  active: "technique" | "rules" | "fairplay";
}) {
  const cls = (isActive: boolean) =>
    `${base} ${
      isActive
        ? "border-primary bg-primary/15 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <nav className="mt-4 flex flex-wrap gap-2" aria-label="Kunskap för spelare">
      <Link
        to="/spelarkunskap"
        aria-current={active === "technique" ? "page" : undefined}
        className={cls(active === "technique")}
      >
        Teknik
      </Link>
      <Link
        to="/spelarkunskap/regler"
        aria-current={active === "rules" ? "page" : undefined}
        className={cls(active === "rules")}
      >
        Regler
      </Link>
      <Link
        to="/spelarkunskap/fair-play"
        aria-current={active === "fairplay" ? "page" : undefined}
        className={cls(active === "fairplay")}
      >
        Fair play
      </Link>
    </nav>
  );
}
