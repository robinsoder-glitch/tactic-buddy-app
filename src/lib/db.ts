import { supabase } from "@/integrations/supabase/client";
import type { Drawing, FieldObject, Frame, PitchType, PlayerRow, PlayerWithPhoto } from "./tactics";

const BUCKET = "player-photos";

export async function signPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function fetchPlayers(): Promise<PlayerWithPhoto[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, number, team, photo_path")
    .order("number", { ascending: true, nullsFirst: false })
    .order("name");
  if (error) throw error;

  const rows = (data ?? []) as PlayerRow[];
  return Promise.all(
    rows.map(async (row) => ({ ...row, photoUrl: await signPhoto(row.photo_path) })),
  );
}

export async function uploadPlayerPhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function savePlayer(input: {
  id?: string | undefined;
  userId: string;
  name: string;
  number: number | null;
  team: string;
  photo_path: string | null;
}) {
  if (input.id) {
    const { error } = await supabase
      .from("players")
      .update({
        name: input.name,
        number: input.number,
        team: input.team,
        photo_path: input.photo_path,
      })
      .eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase
    .from("players")
    .insert({
      user_id: input.userId,
      name: input.name,
      number: input.number,
      team: input.team,
      photo_path: input.photo_path,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deletePlayer(id: string) {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw error;
}

export type TacticSummary = {
  id: string;
  name: string;
  pitch_type: PitchType;
  updated_at: string;
  frameCount: number;
};

export async function fetchTactics(): Promise<TacticSummary[]> {
  const { data, error } = await supabase
    .from("tactics")
    .select("id, name, pitch_type, updated_at, tactic_frames(count)")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const counts = row.tactic_frames as unknown as { count: number }[] | null;
    return {
      id: row.id as string,
      name: row.name as string,
      pitch_type: row.pitch_type as PitchType,
      updated_at: row.updated_at as string,
      frameCount: counts?.[0]?.count ?? 0,
    };
  });
}

export async function createTactic(userId: string, name: string, pitchType: PitchType) {
  const { data, error } = await supabase
    .from("tactics")
    .insert({ user_id: userId, name, pitch_type: pitchType })
    .select("id")
    .single();
  if (error) throw error;

  const { error: frameError } = await supabase.from("tactic_frames").insert({
    tactic_id: data.id,
    user_id: userId,
    position: 0,
    name: "Steg 1",
    objects: [],
    drawings: [],
  });
  if (frameError) throw frameError;

  return data.id as string;
}

export async function renameTactic(id: string, name: string) {
  const { error } = await supabase.from("tactics").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteTactic(id: string) {
  const { error } = await supabase.from("tactics").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateTactic(userId: string, id: string) {
  const source = await fetchTactic(id);
  const { data, error } = await supabase
    .from("tactics")
    .insert({ user_id: userId, name: `${source.name} (kopia)`, pitch_type: source.pitch_type })
    .select("id")
    .single();
  if (error) throw error;

  await saveFrames(data.id as string, userId, source.frames);
  return data.id as string;
}

export type TacticDetail = {
  id: string;
  name: string;
  pitch_type: PitchType;
  frames: Frame[];
};

export async function fetchTactic(id: string): Promise<TacticDetail> {
  const { data, error } = await supabase
    .from("tactics")
    .select("id, name, pitch_type")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: frameRows, error: framesError } = await supabase
    .from("tactic_frames")
    .select("id, name, objects, drawings, position")
    .eq("tactic_id", id)
    .order("position");
  if (framesError) throw framesError;

  const frames: Frame[] = (frameRows ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? null,
    objects: (row.objects as unknown as FieldObject[]) ?? [],
    drawings: (row.drawings as unknown as Drawing[]) ?? [],
  }));

  return {
    id: data.id as string,
    name: data.name as string,
    pitch_type: data.pitch_type as PitchType,
    frames: frames.length ? frames : [{ id: crypto.randomUUID(), name: "Steg 1", objects: [], drawings: [] }],
  };
}

export async function saveFrames(tacticId: string, userId: string, frames: Frame[]) {
  const { error: deleteError } = await supabase
    .from("tactic_frames")
    .delete()
    .eq("tactic_id", tacticId);
  if (deleteError) throw deleteError;

  const payload = frames.map((frame, index) => ({
    tactic_id: tacticId,
    user_id: userId,
    position: index,
    name: frame.name,
    objects: frame.objects as unknown as never,
    drawings: frame.drawings as unknown as never,
  }));

  const { error } = await supabase.from("tactic_frames").insert(payload);
  if (error) throw error;

  await supabase.from("tactics").update({ updated_at: new Date().toISOString() }).eq("id", tacticId);
}
