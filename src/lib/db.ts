import { supabase } from "@/integrations/supabase/client";
import type { Drawing, FieldObject, Frame, PitchType, PlayerRow, PlayerWithPhoto } from "./tactics";
import { parseSharedTactic } from "./shared-tactic";

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
  share_id: string | null;
  is_public: boolean;
  team_id: string | null;
};

export async function fetchTactics(): Promise<TacticSummary[]> {
  const { data, error } = await supabase
    .from("tactics")
    .select("id, name, pitch_type, updated_at, share_id, is_public, team_id, tactic_frames(count)")
    .eq("is_draft", false)
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
      share_id: (row.share_id as string | null) ?? null,
      is_public: Boolean(row.is_public),
      team_id: (row.team_id as string | null) ?? null,
    };
  });
}

export async function createTactic(
  userId: string,
  name: string,
  pitchType: PitchType,
  teamId?: string | null,
  options?: { draft?: boolean },
) {
  const { data, error } = await supabase
    .from("tactics")
    .insert({
      user_id: userId,
      name,
      pitch_type: pitchType,
      team_id: teamId ?? null,
      is_draft: options?.draft ?? false,
    })
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

/**
 * Öppnar arbetsytan med en helt tom tavla. Tidigare utkast raderas så att inga
 * gamla spelare eller ritningar följer med, och så att tomma tavlor inte samlas
 * på hög. Utkastet syns aldrig i "Mina taktiker" förrän användaren sparar.
 */
export async function openBlankTactic(userId: string, name = "Tom tavla"): Promise<string> {
  const { data, error } = await supabase
    .from("tactics")
    .select("id")
    .eq("user_id", userId)
    .eq("is_draft", true);
  if (error) throw error;

  for (const row of data ?? []) {
    await deleteTactic(row.id as string);
  }

  return createTactic(userId, name, "full", null, { draft: true });
}

/** Markerar utkastet som en riktig, sparad taktik. */
export async function publishTactic(id: string, name: string) {
  const { error } = await supabase.from("tactics").update({ name, is_draft: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createTacticFromFrames(
  userId: string,
  name: string,
  pitchType: PitchType,
  teamId: string | null,
  frames: Frame[],
) {
  const { data, error } = await supabase
    .from("tactics")
    .insert({ user_id: userId, name, pitch_type: pitchType, team_id: teamId ?? null })
    .select("id")
    .single();
  if (error) throw error;
  await saveFrames(data.id as string, userId, frames);
  return data.id as string;
}

export async function setTacticPitchType(id: string, pitchType: PitchType) {
  const { error } = await supabase.from("tactics").update({ pitch_type: pitchType }).eq("id", id);
  if (error) throw error;
}

export async function renameTactic(id: string, name: string) {
  const { error } = await supabase.from("tactics").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteTactic(id: string) {
  const { error } = await supabase.from("tactics").delete().eq("id", id);
  if (error) throw error;
}

/** Raderar alla taktiker för användaren, även det osparade utkastet. */
export async function deleteAllTactics(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("tactics")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
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
  share_id?: string;
  is_public?: boolean;
  is_draft?: boolean;
  team_id?: string | null;
  frames: Frame[];
};

export async function fetchTactic(id: string): Promise<TacticDetail> {
  const { data, error } = await supabase
    .from("tactics")
    .select("id, name, pitch_type, share_id, is_public, is_draft, team_id")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: frameRows, error: framesError } = await supabase
    .from("tactic_frames")
    .select("id, name, note, objects, drawings, position")
    .eq("tactic_id", id)
    .order("position");
  if (framesError) throw framesError;

  const frames: Frame[] = (frameRows ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    objects: (row.objects as unknown as FieldObject[]) ?? [],
    drawings: (row.drawings as unknown as Drawing[]) ?? [],
  }));

  return {
    id: data.id as string,
    name: data.name as string,
    pitch_type: data.pitch_type as PitchType,
    share_id: data.share_id as string,
    is_public: data.is_public as boolean,
    is_draft: Boolean(data.is_draft),
    team_id: (data.team_id as string | null) ?? null,
    frames: frames.length
      ? frames
      : [{ id: crypto.randomUUID(), name: "Steg 1", objects: [], drawings: [] }],
  };
}

/**
 * Sparar sekvensen. Tidigare steg läses in först och läggs tillbaka om
 * skrivningen misslyckas, så att ett avbrutet sparande aldrig lämnar taktiken
 * tom. Ett sparfel lämnar alltså föregående tillstånd orört.
 */
export async function saveFrames(tacticId: string, userId: string, frames: Frame[]) {
  const { data: previous, error: readError } = await supabase
    .from("tactic_frames")
    .select("id, tactic_id, user_id, position, name, note, objects, drawings")
    .eq("tactic_id", tacticId);
  if (readError) throw new Error(readError.message);

  const { error: deleteError } = await supabase
    .from("tactic_frames")
    .delete()
    .eq("tactic_id", tacticId);
  if (deleteError) throw new Error(deleteError.message);

  const payload = frames.map((frame, index) => ({
    tactic_id: tacticId,
    user_id: userId,
    position: index,
    name: frame.name,
    note: frame.note ?? null,
    objects: frame.objects as unknown as never,
    drawings: frame.drawings as unknown as never,
  }));

  const { error } = await supabase.from("tactic_frames").insert(payload);
  if (error) {
    if ((previous ?? []).length > 0) {
      await supabase.from("tactic_frames").insert(previous as never);
    }
    throw new Error(error.message);
  }

  await supabase
    .from("tactics")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", tacticId);
}

export async function setTacticSharing(id: string, isPublic: boolean) {
  const { error } = await supabase.from("tactics").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}

/**
 * Publik delningslänk. Läses via en säker databasfunktion som tar bort
 * spelar-id, foto-länkar och riktiga namn innan innehållet lämnar databasen.
 */
export async function fetchSharedTactic(shareId: string): Promise<TacticDetail> {
  const { data, error } = await supabase.rpc("get_shared_tactic", { _share_id: shareId });
  if (error) throw error;
  return parseSharedTactic(data);
}

/** First frame of every tactic, used for list thumbnails. */
export async function fetchTacticPreviews(): Promise<Record<string, Frame>> {
  const { data, error } = await supabase
    .from("tactic_frames")
    .select("id, tactic_id, name, note, objects, drawings")
    .eq("position", 0);
  if (error) throw error;
  const map: Record<string, Frame> = {};
  for (const row of data ?? []) {
    map[row.tactic_id as string] = {
      id: row.id as string,
      name: (row.name as string | null) ?? null,
      note: (row.note as string | null) ?? null,
      objects: (row.objects as unknown as FieldObject[]) ?? [],
      drawings: (row.drawings as unknown as Drawing[]) ?? [],
    };
  }
  return map;
}
