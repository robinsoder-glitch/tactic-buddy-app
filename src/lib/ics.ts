import type { TeamEvent } from "./teams";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIcsDate(date: Date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(events: TeamEvent[], teamName: string) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fotbollsrummet//SV",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escape(teamName)}`,
  ];

  for (const event of events) {
    const start = new Date(event.starts_at);
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    const title = event.title ?? (event.type === "training" ? "Träning" : "Match");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@taktiktavlan`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:${escape(`${teamName} – ${title}`)}`,
    );
    if (event.location) lines.push(`LOCATION:${escape(event.location)}`);
    if (event.notes) lines.push(`DESCRIPTION:${escape(event.notes)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(events: TeamEvent[], teamName: string) {
  const blob = new Blob([buildIcs(events, teamName)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${teamName.replace(/[^a-z0-9åäö]+/gi, "-").toLowerCase() || "lag"}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
