/** Aktivitetstyp och titel hålls isär så att kort aldrig visar "MatchMatch". */
export type EventLike = {
  type?: string | null;
  title?: string | null;
  cancelled_at?: string | null;
  home_team?: string | null;
  away_team?: string | null;
};

export function eventTypeLabel(event: EventLike): "Match" | "Träning" {
  return event.type === "match" ? "Match" : "Träning";
}

/** Egen titel om den finns, annars typens namn – aldrig båda efter varandra. */
export function eventDisplayTitle(event: EventLike): string {
  const typeLabel = eventTypeLabel(event);
  const custom = event.title?.trim();
  if (custom && custom.toLowerCase() !== typeLabel.toLowerCase()) return custom;
  if (!custom && event.type === "match" && (event.home_team || event.away_team)) {
    return `${event.home_team ?? "Hemma"} – ${event.away_team ?? "Borta"}`;
  }
  return typeLabel;
}

export function isCancelled(event: EventLike): boolean {
  return Boolean(event.cancelled_at);
}

/** Badgarna som ska visas bredvid titeln: typ först, därefter status. */
export function eventBadges(event: EventLike): string[] {
  return isCancelled(event) ? [eventTypeLabel(event), "Inställd"] : [eventTypeLabel(event)];
}

/** Titelrad som aldrig upprepar typen, t.ex. "Träning" under rubriken Träning. */
export function eventTitleLine(event: EventLike): string | null {
  const title = eventDisplayTitle(event);
  return title === eventTypeLabel(event) ? null : title;
}
