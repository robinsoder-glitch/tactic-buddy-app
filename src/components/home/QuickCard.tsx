import { Link } from "@tanstack/react-router";

export function QuickCard({
  to,
  icon,
  title,
  text,
  primary,
  badge = 0,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  primary?: boolean;
  /** Antal olästa – visas som en röd bricka uppe till höger. */
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className={`group relative flex flex-col gap-1 rounded-2xl p-5 transition-all hover:-translate-y-0.5 ${
        primary
          ? "glass-card border-primary/40 bg-primary/10 hover:bg-primary/15"
          : "glass-card hover:border-primary/50"
      }`}
    >
      {badge > 0 && (
        <span
          aria-label={`${badge} olästa meddelanden`}
          className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold leading-none text-destructive-foreground"
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary transition-transform group-hover:scale-110">
        {icon}
      </span>
      <span className="mt-2 font-display text-lg font-semibold leading-tight">{title}</span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </Link>
  );
}
