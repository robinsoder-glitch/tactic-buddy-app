import { Link } from "@tanstack/react-router";

const base =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors";

export function KnowledgeTabs({ active }: { active: "articles" | "mistakes" }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-2" aria-label="Kunskapsbankens sidor">
      <Link
        to="/kunskapsbank"
        aria-current={active === "articles" ? "page" : undefined}
        className={`${base} ${
          active === "articles"
            ? "border-primary bg-primary/15 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        Artiklar
      </Link>
      <Link
        to="/kunskapsbank/vanliga-misstag"
        aria-current={active === "mistakes" ? "page" : undefined}
        className={`${base} ${
          active === "mistakes"
            ? "border-primary bg-primary/15 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        Vanliga misstag
      </Link>
    </nav>
  );
}
