import { Link } from "@tanstack/react-router";

const base =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors";

export function KnowledgeTabs({ active }: { active: "articles" | "mistakes" | "technique" | "favorites" }) {
  const cls = (isActive: boolean) =>
    `${base} ${
      isActive
        ? "border-primary bg-primary/15 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <nav className="mt-4 flex flex-wrap gap-2" aria-label="Kunskapsbankens sidor">
      <Link
        to="/kunskapsbank"
        aria-current={active === "articles" ? "page" : undefined}
        className={cls(active === "articles")}
      >
        Artiklar
      </Link>
      <Link
        to="/kunskapsbank/vanliga-misstag"
        aria-current={active === "mistakes" ? "page" : undefined}
        className={cls(active === "mistakes")}
      >
        Vanliga misstag
      </Link>
      <Link
        to="/kunskapsbank/teknik"
        aria-current={active === "technique" ? "page" : undefined}
        className={cls(active === "technique")}
      >
        Teknik
      </Link>
      <Link
        to="/kunskapsbank/favoriter"
        aria-current={active === "favorites" ? "page" : undefined}
        className={cls(active === "favorites")}
      >
        Mina favoriter
      </Link>
    </nav>
  );
}
