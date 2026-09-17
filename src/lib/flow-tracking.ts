/**
 * Spårning av nyckelhändelser i inbjudningsflödet, så vi ser var familjer
 * och tränare tappar bort sig. Loggningen är "fire and forget" – den får
 * aldrig stoppa eller fördröja själva flödet.
 */

import { supabase } from "@/integrations/supabase/client";

export const FLOW_EVENTS = [
  "invite_opened",
  "invite_signup_clicked",
  "invite_signin_clicked",
  "invite_signed_in",
  "invite_join_submitted",
  "invite_join_pending",
  "invite_join_approved",
  "invite_join_failed",
  "invite_link_invalid",
  "coach_start_opened",
  "coach_player_added",
  "coach_invite_copied",
  "coach_family_approved",
] as const;

export type FlowEvent = (typeof FLOW_EVENTS)[number];

export type FlowEventInput = {
  teamCode?: string | null;
  teamId?: string | null;
  role?: string | null;
  details?: Record<string, unknown>;
};

/** Läsbara namn för händelserna, används i admin-översikten. */
export const FLOW_EVENT_LABELS: Record<FlowEvent, string> = {
  invite_opened: "Öppnade inbjudningslänken",
  invite_signup_clicked: "Klickade skapa konto",
  invite_signin_clicked: "Klickade logga in",
  invite_signed_in: "Inloggad på inbjudningssidan",
  invite_join_submitted: "Skickade ansökan",
  invite_join_pending: "Väntar på godkännande",
  invite_join_approved: "Godkänd och med i laget",
  invite_join_failed: "Ansökan misslyckades",
  invite_link_invalid: "Länken fungerade inte",
  coach_start_opened: "Tränaren öppnade Kom igång",
  coach_player_added: "Tränaren lade till spelare",
  coach_invite_copied: "Tränaren kopierade länken",
  coach_family_approved: "Tränaren godkände en familj",
};

/** Ordningen i familjens tratt, för att se var man faller ifrån. */
export const FAMILY_FUNNEL: FlowEvent[] = [
  "invite_opened",
  "invite_signup_clicked",
  "invite_signed_in",
  "invite_join_submitted",
  "invite_join_approved",
];

export async function trackFlowEvent(event: FlowEvent, input: FlowEventInput = {}): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from("invite_flow_events").insert({
      event,
      team_code: input.teamCode ?? null,
      team_id: input.teamId ?? null,
      user_id: data.user?.id ?? null,
      role: input.role ?? null,
      path: typeof window === "undefined" ? null : window.location.pathname,
      details: (input.details ?? {}) as never,
    });
  } catch {
    /* spårningen får aldrig störa användaren */
  }
}

export type FunnelRow = { event: FlowEvent; label: string; count: number; dropoff: number };

/** Räknar ihop trattens steg och hur många som faller bort mellan stegen. */
export function buildFunnel(counts: Partial<Record<string, number>>): FunnelRow[] {
  let previous: number | null = null;
  return FAMILY_FUNNEL.map((event) => {
    const count = counts[event] ?? 0;
    const dropoff = previous === null ? 0 : Math.max(previous - count, 0);
    previous = count;
    return { event, label: FLOW_EVENT_LABELS[event], count, dropoff };
  });
}
