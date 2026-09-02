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
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]));
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

/** Kort tidsetikett, t.ex. "5 sep 19:00". */
export function chatTime(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
