import { supabase } from "@/integrations/supabase/client";

/** En övning som tränaren skapat själv, direkt i en träningsplanering. */
export type CoachDrill = {
  id: string;
  user_id: string;
  team_id: string | null;
  title: string;
  minutes: number;
  instruction: string | null;
  purpose: string | null;
  equipment: string | null;
  coach_focus: string | null;
  in_library: boolean;
};

export type CoachDrillInput = {
  title: string;
  minutes: number;
  instruction?: string | null;
  purpose?: string | null;
  equipment?: string | null;
  coachFocus?: string | null;
  inLibrary?: boolean;
  teamId?: string | null;
};

/** Enkel validering som används av både formuläret och testerna. */
export function validateCoachDrill(input: {
  title: string;
  minutes: string | number;
}): string | null {
  if (!String(input.title).trim()) return "Ange en titel för övningen.";
  const minutes = Number(input.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return "Ange tid i minuter.";
  return null;
}

export async function fetchCoachDrills(): Promise<CoachDrill[]> {
  const { data, error } = await supabase
    .from("coach_drills")
    .select(
      "id, user_id, team_id, title, minutes, instruction, purpose, equipment, coach_focus, in_library",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CoachDrill[];
}

export async function createCoachDrill(
  input: CoachDrillInput,
  userId: string,
): Promise<CoachDrill> {
  const { data, error } = await supabase
    .from("coach_drills")
    .insert({
      user_id: userId,
      team_id: input.teamId ?? null,
      title: input.title.trim(),
      minutes: Math.round(Number(input.minutes)) || 10,
      instruction: input.instruction?.trim() || null,
      purpose: input.purpose?.trim() || null,
      equipment: input.equipment?.trim() || null,
      coach_focus: input.coachFocus?.trim() || null,
      in_library: Boolean(input.inLibrary),
    })
    .select(
      "id, user_id, team_id, title, minutes, instruction, purpose, equipment, coach_focus, in_library",
    )
    .single();
  if (error) throw error;
  return data as CoachDrill;
}
