/** Gemensam datum- och tidsformatering på svenska. */
export function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function timeOnly(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}
