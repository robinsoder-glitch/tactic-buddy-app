import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  id: string;
  team_id: string;
  user_id: string;
  body: string;
  created_at: string;
  displayName: string | null;
};

/** Hämtar lagets tränarsnack, äldsta först. */
export async function fetchTeamChat(teamId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("team_chat_messages")
    .select("id, team_id, user_id, body, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;

  const rows = (data ?? []) as Omit<ChatMessage, "displayName">[];
  if (!rows.length) return [];

  const ids = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const names = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]),
  );
  return rows.map((row) => ({ ...row, displayName: names.get(row.user_id) ?? null }));
}

export async function sendTeamChatMessage(teamId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("Skriv ett meddelande först.");
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Du måste vara inloggad.");

  const { error } = await supabase
    .from("team_chat_messages")
    .insert({ team_id: teamId, user_id: userId, body: text });
  if (error) throw error;
}

export async function deleteTeamChatMessage(id: string) {
  const { error } = await supabase.from("team_chat_messages").delete().eq("id", id);
  if (error) throw error;
}

/* --------------------------- oläst-markering --------------------------- */
/* Lässtatus sparas server-side i team_chat_reads så den följer med mellan enheter. */

export type ChatRead = { team_id: string; last_read_at: string };

export async function fetchChatReads(teamIds: string[]): Promise<Record<string, string>> {
  if (!teamIds.length) return {};
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return {};
  const { data, error } = await supabase
    .from("team_chat_reads")
    .select("team_id, last_read_at")
    .eq("user_id", userId)
    .in("team_id", teamIds);
  if (error) return {};
  return Object.fromEntries(
    ((data ?? []) as ChatRead[]).map((row) => [row.team_id, row.last_read_at]),
  );
}

/** Sparar att lagets chatt är läst just nu. */
export async function markChatRead(
  teamId: string,
  when: string = new Date().toISOString(),
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;
  await supabase
    .from("team_chat_reads")
    .upsert(
      { team_id: teamId, user_id: userId, last_read_at: when },
      { onConflict: "team_id,user_id" },
    );
}

/** Räknar olästa meddelanden (skrivna av någon annan) i angivna lag. */
export function countUnread(
  rows: { team_id: string; user_id: string; created_at: string }[],
  myUserId: string | null,
  reads: Record<string, string> = {},
): number {
  return rows.filter((row) => {
    if (myUserId && row.user_id === myUserId) return false;
    const last = reads[row.team_id];
    return !last || row.created_at > last;
  }).length;
}

export async function fetchUnreadChatCount(
  teamIds: string[],
  myUserId: string | null,
): Promise<number> {
  if (!teamIds.length) return 0;
  const [{ data, error }, reads] = await Promise.all([
    supabase
      .from("team_chat_messages")
      .select("team_id, user_id, created_at")
      .in("team_id", teamIds)
      .order("created_at", { ascending: false })
      .limit(200),
    fetchChatReads(teamIds),
  ]);
  if (error) return 0;
  return countUnread(
    (data ?? []) as { team_id: string; user_id: string; created_at: string }[],
    myUserId,
    reads,
  );
}

/** Kort tidsetikett, t.ex. "5 sep 19:00". */
export function chatTime(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
